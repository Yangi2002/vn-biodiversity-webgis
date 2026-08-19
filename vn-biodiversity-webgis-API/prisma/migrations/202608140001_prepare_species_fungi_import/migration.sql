CREATE TABLE IF NOT EXISTS public.fungi_db_vn (
  species_id text PRIMARY KEY,
  source_loai text,
  detail_url text,
  page text,
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
  ban_do_phan_bo_cua_loai text,
  list_ten_viet_nam text,
  list_ten_latin text,
  hinh text,
  source_table text,
  source_slug text,
  source_post_url text,
  ten_tieng_anh text,
  dong_danh text,
  ten_khac text,
  gioi text,
  nganh text,
  lop text,
  do_cao text,
  ma_dinh_danh text,
  xac_dinh_boi text,
  moi_truong_song text,
  sinh_thai text
);

CREATE INDEX IF NOT EXISTS idx_fungi_db_vn_species_id ON public.fungi_db_vn (species_id);
CREATE INDEX IF NOT EXISTS idx_fungi_db_vn_ten_latin ON public.fungi_db_vn (ten_latin);
CREATE INDEX IF NOT EXISTS idx_fungi_db_vn_ten_viet_nam ON public.fungi_db_vn (ten_viet_nam);

DO $$
BEGIN
  IF to_regclass('public.species_conservation_terms') IS NOT NULL THEN
    ALTER TABLE public.species_conservation_terms
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;

  IF to_regclass('public.species_images') IS NOT NULL THEN
    ALTER TABLE public.species_images
      ADD COLUMN IF NOT EXISTS fungi_species_id text,
      ADD COLUMN IF NOT EXISTS source_image_url text,
      ADD COLUMN IF NOT EXISTS caption text,
      ADD COLUMN IF NOT EXISTS file_size bigint,
      ADD COLUMN IF NOT EXISTS sha256 text,
      ADD COLUMN IF NOT EXISTS download_status text,
      ADD COLUMN IF NOT EXISTS error text;
  END IF;

  IF to_regclass('public.species_showpic_metadata') IS NOT NULL THEN
    ALTER TABLE public.species_showpic_metadata
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;

  IF to_regclass('public.species_taxonomy') IS NOT NULL THEN
    ALTER TABLE public.species_taxonomy
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;

  IF to_regclass('public.species_keyword_links') IS NOT NULL THEN
    ALTER TABLE public.species_keyword_links
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;

  IF to_regclass('public.species_gbif_occurrence_matches') IS NOT NULL THEN
    ALTER TABLE public.species_gbif_occurrence_matches
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;

  IF to_regclass('public.species_vnredlist_matches') IS NOT NULL THEN
    ALTER TABLE public.species_vnredlist_matches
      ADD COLUMN IF NOT EXISTS fungi_species_id text;
  END IF;
END $$;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    WITH import_tables(table_oid) AS (
      SELECT to_regclass('public.species_conservation_terms') UNION ALL
      SELECT to_regclass('public.species_images') UNION ALL
      SELECT to_regclass('public.species_showpic_metadata') UNION ALL
      SELECT to_regclass('public.species_taxonomy') UNION ALL
      SELECT to_regclass('public.species_keyword_links') UNION ALL
      SELECT to_regclass('public.species_gbif_occurrence_matches') UNION ALL
      SELECT to_regclass('public.species_vnredlist_matches') UNION ALL
      SELECT to_regclass('public.vnredlist_profiles')
    )
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE conrelid IN (
      SELECT table_oid
      FROM import_tables
      WHERE table_oid IS NOT NULL
    )
    AND (
      contype IN ('f', 'c')
      OR (
        contype IN ('p', 'u')
        AND conrelid IN (
          to_regclass('public.species_conservation_terms'),
          to_regclass('public.species_keyword_links'),
          to_regclass('public.species_gbif_occurrence_matches'),
          to_regclass('public.species_vnredlist_matches')
        )
      )
      OR (
        contype = 'u'
        AND conrelid = to_regclass('public.vnredlist_profiles')
      )
    )
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      constraint_row.table_name,
      constraint_row.conname
    );
  END LOOP;
END $$;
