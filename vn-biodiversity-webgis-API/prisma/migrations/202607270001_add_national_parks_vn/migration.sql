CREATE TABLE IF NOT EXISTS public.national_parks_vn (
    park_id text NOT NULL,
    source text,
    map_url text,
    detail_url text,
    slug text,
    title text,
    map_popup_title text,
    map_popup_excerpt text,
    author text,
    thumbnail_url text,
    tom_tat text,
    quyet_dinh_thanh_lap text,
    toa_do_dia_ly text,
    quy_mo_dien_tich text,
    muc_tieu_nhiem_vu text,
    co_quan_cap_quan_ly text,
    ban_quan_ly text,
    vi_tri_dia_ly text,
    da_dang_sinh_hoc text,
    he_thuc_vat text,
    he_dong_vat text,
    hoat_dong_du_lich text,
    du_an_lien_quan text,
    dan_so_trong_vung text,
    nguon_tham_khao text,
    detail_sections_json text,
    content_text text,
    image_urls text,
    image_captions text,
    image_group_id text,
    primary_image_url text,
    primary_image_path text,
    image_count text,
    local_image_paths text,
    image_metadata_json text,
    source_payload text,
    CONSTRAINT pk_national_parks_vn PRIMARY KEY (park_id)
);

CREATE INDEX IF NOT EXISTS idx_national_parks_vn_detail_url
    ON public.national_parks_vn USING btree (detail_url);

CREATE INDEX IF NOT EXISTS idx_national_parks_vn_title
    ON public.national_parks_vn USING btree (title);

CREATE INDEX IF NOT EXISTS idx_national_parks_vn_source
    ON public.national_parks_vn USING btree (source);

CREATE INDEX IF NOT EXISTS idx_national_parks_vn_search
    ON public.national_parks_vn
    USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(map_popup_title, '') || ' ' || coalesce(content_text, '')));
