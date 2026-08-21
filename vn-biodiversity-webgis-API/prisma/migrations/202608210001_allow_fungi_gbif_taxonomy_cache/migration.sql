DO $$
DECLARE
  constraint_row record;
BEGIN
  IF to_regclass('public.gbif_taxonomy_cache') IS NULL THEN
    RETURN;
  END IF;

  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.gbif_taxonomy_cache'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_table%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.gbif_taxonomy_cache DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;

  ALTER TABLE public.gbif_taxonomy_cache
    ADD CONSTRAINT gbif_taxonomy_cache_source_table_check
    CHECK (
      source_table IN (
        'animal_db_vn',
        'plant_db_vn',
        'insect_db_vn',
        'fungi_db_vn'
      )
    );
END $$;
