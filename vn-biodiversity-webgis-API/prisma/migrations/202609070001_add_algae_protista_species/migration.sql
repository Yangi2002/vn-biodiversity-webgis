CREATE TABLE IF NOT EXISTS public.algae_db_vn (
  species_id text PRIMARY KEY,
  ten_viet_nam text,
  ten_latin text,
  ho text,
  bo text,
  lop_nhom text,
  title_block text,
  dac_diem_nhan_dang text,
  dac_diem_bo_sung text,
  kich_thuoc text,
  sinh_hoc_sinh_thai text,
  phan_bo text,
  phan_hang text,
  gia_tri text,
  tinh_trang text,
  bien_phap_bao_ve text,
  tai_lieu_dan text,
  cong_dung text,
  mo_ta text,
  mo_ta_loai text,
  mau_mo_ta text,
  hinh text
);

CREATE INDEX IF NOT EXISTS idx_algae_db_vn_ten_latin ON public.algae_db_vn (ten_latin);
CREATE INDEX IF NOT EXISTS idx_algae_db_vn_ten_viet_nam ON public.algae_db_vn (ten_viet_nam);

CREATE TABLE IF NOT EXISTS public.protista_db_vn (
  species_id text PRIMARY KEY,
  ten_viet_nam text,
  ten_latin text,
  ho text,
  bo text,
  lop_nhom text,
  title_block text,
  dac_diem_nhan_dang text,
  dac_diem_bo_sung text,
  kich_thuoc text,
  sinh_hoc_sinh_thai text,
  phan_bo text,
  phan_hang text,
  gia_tri text,
  tinh_trang text,
  bien_phap_bao_ve text,
  tai_lieu_dan text,
  cong_dung text,
  mo_ta text,
  mo_ta_loai text,
  mau_mo_ta text,
  hinh text
);

CREATE INDEX IF NOT EXISTS idx_protista_db_vn_ten_latin ON public.protista_db_vn (ten_latin);
CREATE INDEX IF NOT EXISTS idx_protista_db_vn_ten_viet_nam ON public.protista_db_vn (ten_viet_nam);

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
        'fungi_db_vn',
        'algae_db_vn',
        'protista_db_vn'
      )
    );
END $$;
