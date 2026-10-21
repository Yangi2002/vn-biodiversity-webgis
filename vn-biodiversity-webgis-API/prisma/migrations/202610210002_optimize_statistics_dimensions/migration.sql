ALTER TABLE public.gbif_occurrences
  ADD COLUMN IF NOT EXISTS stats_observed_year integer
  GENERATED ALWAYS AS (
    CASE
      WHEN observed_date ~ '^\d{4}' THEN substring(observed_date from 1 for 4)::integer
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.gbif_occurrences
  ADD COLUMN IF NOT EXISTS stats_region text
  GENERATED ALWAYS AS (
    coalesce(
      nullif(source_payload -> 'gadm' -> 'level1' ->> 'name', ''),
      nullif(source_payload ->> 'gbifRegion', ''),
      nullif(location, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_stats_year
  ON public.gbif_occurrences(stats_observed_year, gbif_occurrence_key);

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_stats_region
  ON public.gbif_occurrences(stats_region, gbif_occurrence_key)
  WHERE stats_region IS NOT NULL AND stats_region <> '';

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_stats_filter
  ON public.gbif_occurrences(stats_observed_year, basis_of_record, gbif_occurrence_key)
  INCLUDE (stats_region, image_url, has_geospatial_issue, latitude, longitude);

ANALYZE public.gbif_occurrences;
ANALYZE public.species_gbif_occurrence_matches;
