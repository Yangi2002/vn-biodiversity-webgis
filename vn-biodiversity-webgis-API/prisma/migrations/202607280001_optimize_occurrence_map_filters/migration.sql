CREATE INDEX IF NOT EXISTS idx_species_gbif_source_occurrence_species
ON species_gbif_occurrence_matches (source_table, gbif_occurrence_key, species_id);

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_year_geo_valid
ON gbif_occurrences (((substring(observed_date from 1 for 4))::int), latitude, longitude, gbif_occurrence_key)
WHERE observed_date ~ '^\d{4}'
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND coalesce(has_geospatial_issue, false) = false;
