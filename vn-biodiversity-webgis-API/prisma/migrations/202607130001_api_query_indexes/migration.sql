CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_vn_geo_valid
ON gbif_occurrences (latitude, longitude, gbif_occurrence_key)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND coalesce(has_geospatial_issue, false) = false;

CREATE INDEX IF NOT EXISTS idx_gbif_occurrences_observed_year_expr
ON gbif_occurrences (((substring(observed_date from 1 for 4))::int))
WHERE observed_date ~ '^\d{4}';

CREATE INDEX IF NOT EXISTS idx_species_gbif_occurrence_key_species
ON species_gbif_occurrence_matches (gbif_occurrence_key, source_table, species_id);

CREATE INDEX IF NOT EXISTS idx_taxon_closure_descendant_depth
ON taxon_closure (descendant_taxon_id, ancestor_taxon_id, depth);

CREATE INDEX IF NOT EXISTS idx_taxa_rank
ON taxa (rank);

CREATE INDEX IF NOT EXISTS idx_taxa_canonical_name_trgm
ON taxa USING gin (lower(canonical_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxa_normalized_name_trgm
ON taxa USING gin (lower(normalized_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxon_names_name_trgm
ON taxon_names USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxon_names_normalized_name_trgm
ON taxon_names USING gin (lower(normalized_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_animal_search_vietnamese_trgm
ON animal_db_vn USING gin (lower(coalesce(ten_viet_nam, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_animal_search_latin_trgm
ON animal_db_vn USING gin (lower(coalesce(ten_latin, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_animal_search_family_trgm
ON animal_db_vn USING gin (lower(coalesce(ho, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_animal_search_order_trgm
ON animal_db_vn USING gin (lower(coalesce(bo, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_animal_search_class_trgm
ON animal_db_vn USING gin (lower(coalesce(lop_nhom, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_search_vietnamese_trgm
ON plant_db_vn USING gin (lower(coalesce(ten_viet_nam, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_search_latin_trgm
ON plant_db_vn USING gin (lower(coalesce(ten_latin, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_search_family_trgm
ON plant_db_vn USING gin (lower(coalesce(ho, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_search_order_trgm
ON plant_db_vn USING gin (lower(coalesce(bo, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_search_class_trgm
ON plant_db_vn USING gin (lower(coalesce(lop_nhom, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_insect_search_vietnamese_trgm
ON insect_db_vn USING gin (lower(coalesce(ten_viet_nam, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_insect_search_latin_trgm
ON insect_db_vn USING gin (lower(coalesce(ten_latin, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_insect_search_family_trgm
ON insect_db_vn USING gin (lower(coalesce(ho, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_insect_search_order_trgm
ON insect_db_vn USING gin (lower(coalesce(bo, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_insect_search_class_trgm
ON insect_db_vn USING gin (lower(coalesce(lop_nhom, '')) gin_trgm_ops);
