ALTER TABLE "species_change_requests"
  DROP CONSTRAINT IF EXISTS "species_change_requests_source_table_check";

ALTER TABLE "species_change_requests"
  ADD CONSTRAINT "species_change_requests_source_table_check"
  CHECK (
    "source_table" IN (
      'animal_db_vn',
      'plant_db_vn',
      'insect_db_vn',
      'fungi_db_vn',
      'algae_db_vn',
      'protista_db_vn'
    )
  );
