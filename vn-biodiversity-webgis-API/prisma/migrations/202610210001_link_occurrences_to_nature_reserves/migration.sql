BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.nature_reserves
  ADD COLUMN IF NOT EXISTS boundary_geom geometry(Geometry, 4326);

CREATE OR REPLACE FUNCTION public.nature_reserve_geometry_from_geojson(payload jsonb)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result geometry;
BEGIN
  IF payload IS NULL THEN
    RETURN NULL;
  END IF;

  IF payload ->> 'type' = 'FeatureCollection' THEN
    SELECT ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature -> 'geometry')::text), 4326))
    INTO result
    FROM jsonb_array_elements(payload -> 'features') AS item(feature)
    WHERE feature -> 'geometry' IS NOT NULL;
  ELSIF payload ->> 'type' = 'Feature' THEN
    result := ST_SetSRID(ST_GeomFromGeoJSON((payload -> 'geometry')::text), 4326);
  ELSE
    result := ST_SetSRID(ST_GeomFromGeoJSON(payload::text), 4326);
  END IF;

  RETURN CASE
    WHEN result IS NULL THEN NULL
    ELSE ST_MakeValid(ST_Force2D(result))
  END;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

UPDATE public.nature_reserves
SET boundary_geom = public.nature_reserve_geometry_from_geojson(geometry)
WHERE geometry IS NOT NULL
  AND boundary_geom IS NULL;

CREATE OR REPLACE FUNCTION public.sync_nature_reserve_boundary_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.boundary_geom := public.nature_reserve_geometry_from_geojson(NEW.geometry);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nature_reserve_boundary_geom ON public.nature_reserves;
CREATE TRIGGER trg_sync_nature_reserve_boundary_geom
BEFORE INSERT OR UPDATE OF geometry ON public.nature_reserves
FOR EACH ROW EXECUTE FUNCTION public.sync_nature_reserve_boundary_geom();

CREATE INDEX IF NOT EXISTS idx_nature_reserves_boundary_geom
  ON public.nature_reserves USING gist (boundary_geom);

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_point_geom
  ON public.gbif_occurrences
  USING gist (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND coalesce(has_geospatial_issue, false) = false;

CREATE TABLE IF NOT EXISTS public.nature_reserve_occurrence_matches (
  reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
  gbif_occurrence_key bigint NOT NULL REFERENCES public.gbif_occurrences(gbif_occurrence_key) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reserve_source_id, gbif_occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_nature_reserve_occurrence_matches_occurrence
  ON public.nature_reserve_occurrence_matches(gbif_occurrence_key, reserve_source_id);

CREATE OR REPLACE FUNCTION public.refresh_nature_reserve_occurrence_matches()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count bigint;
BEGIN
  TRUNCATE TABLE public.nature_reserve_occurrence_matches;

  INSERT INTO public.nature_reserve_occurrence_matches (reserve_source_id, gbif_occurrence_key)
  SELECT DISTINCT reserve.source_id, occurrence.gbif_occurrence_key
  FROM public.nature_reserves AS reserve
  JOIN public.gbif_occurrences AS occurrence
    ON reserve.boundary_geom IS NOT NULL
   AND reserve.boundary_geom && ST_SetSRID(ST_MakePoint(occurrence.longitude, occurrence.latitude), 4326)
   AND ST_Covers(
     reserve.boundary_geom,
     ST_SetSRID(ST_MakePoint(occurrence.longitude, occurrence.latitude), 4326)
   )
  WHERE occurrence.latitude IS NOT NULL
    AND occurrence.longitude IS NOT NULL
    AND coalesce(occurrence.has_geospatial_issue, false) = false;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

SELECT public.refresh_nature_reserve_occurrence_matches();

COMMIT;
