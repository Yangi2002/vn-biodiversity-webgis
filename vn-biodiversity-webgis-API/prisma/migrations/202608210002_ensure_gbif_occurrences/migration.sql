CREATE TABLE IF NOT EXISTS public.gbif_occurrences (
  gbif_occurrence_key bigint PRIMARY KEY,
  gbif_taxon_key bigint,
  image_url text,
  latitude double precision,
  longitude double precision,
  observed_date text,
  location text,
  observer text,
  quality_grade text,
  basis_of_record text,
  has_geospatial_issue boolean,
  issues jsonb,
  occurrence_url text,
  source_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_date ON public.gbif_occurrences (observed_date);
CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_geo ON public.gbif_occurrences (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_taxon ON public.gbif_occurrences (gbif_taxon_key);
CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_vn_geo_valid
  ON public.gbif_occurrences (latitude, longitude, gbif_occurrence_key)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND coalesce(has_geospatial_issue, false) = false;
