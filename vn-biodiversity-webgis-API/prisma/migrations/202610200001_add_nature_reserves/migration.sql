BEGIN;

CREATE TABLE IF NOT EXISTS public.nature_reserves (
    source_id text PRIMARY KEY,
    reserve_code text NOT NULL UNIQUE,
    name text NOT NULL,
    reserve_type text,
    province text,
    district text,
    ward text,
    socio_economic_region text,
    heritage_level text,
    heritage_classification text,
    heritage_subgroup text,
    biodiversity_conservation_subgroup text,
    international_designations text,
    scope text,
    conservation_criteria text,
    management_agency text,
    established_year integer,
    establishment_document_title text,
    document_number text,
    issued_date date,
    issuing_authority text,
    longitude numeric(11, 7),
    latitude numeric(10, 7),
    center_coordinates jsonb,
    total_area_ha numeric(18, 4),
    core_area_ha numeric(18, 4),
    strict_protection_area_ha numeric(18, 4),
    ecological_restoration_area_ha numeric(18, 4),
    administration_service_area_ha numeric(18, 4),
    buffer_area_ha numeric(18, 4),
    transition_area_ha numeric(18, 4),
    boundary_text text,
    description text,
    source_citation text,
    planning_status text,
    operating_status text,
    representative_image_url text,
    representative_image_credit text,
    collection_image_count integer NOT NULL DEFAULT 0,
    detail_url text,
    source_created_at date,
    source_updated_at date,
    geometry jsonb,
    source_payload jsonb,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_nature_reserves_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT ck_nature_reserves_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public.nature_reserve_documents (
    document_id text PRIMARY KEY,
    reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
    source_record_id text,
    document_code text,
    title text,
    heritage_title text,
    document_type text,
    document_number text,
    issuing_authority text,
    issued_year integer,
    issued_date date,
    file_name text,
    file_url text,
    source_created_at date,
    source_updated_at date,
    source_payload jsonb,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nature_reserve_ecosystems (
    ecosystem_id text PRIMARY KEY,
    reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
    source_record_id text,
    inventory_code text,
    inventory_name text,
    ecosystem_type text,
    ecosystem_group text,
    ecosystem_subtype text,
    total_area_ha numeric(18, 4),
    area_ha numeric(18, 4),
    vegetation_cover text,
    ecological_status text,
    ecosystem_structure text,
    inventory_period text,
    inventory_location text,
    implementing_agency text,
    publication_date date,
    publication_source text,
    description text,
    source_citation text,
    data_source text,
    source_created_at date,
    source_updated_at date,
    source_payload jsonb,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nature_reserve_species_inventories (
    inventory_id text PRIMARY KEY,
    reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
    source_record_id text,
    inventory_code text,
    inventory_name text,
    inventory_period text,
    inventory_location text,
    implementing_agency text,
    species_count integer,
    publication_date date,
    publication_source text,
    source_created_at date,
    source_updated_at date,
    source_payload jsonb,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nature_reserve_genetic_resources (
    genetic_resource_id text PRIMARY KEY,
    reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
    source_record_id text,
    resource_code text,
    resource_name text,
    local_name text,
    scientific_name text,
    resource_classification text,
    genetic_origin text,
    strain_code text,
    resource_symbol text,
    kingdom text,
    phylum text,
    class_name text,
    order_name text,
    family text,
    genus text,
    species text,
    province text,
    transfer_isolation_place text,
    storage_location text,
    received_date date,
    morphology text,
    cell_characteristics text,
    biological_activity text,
    gene_sequence text,
    preservation_conditions text,
    culture_medium text,
    usage_scope text,
    toxicity text,
    source_citation text,
    source_created_at date,
    source_updated_at date,
    source_payload jsonb,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nature_reserve_files (
    file_id text PRIMARY KEY,
    reserve_source_id text NOT NULL REFERENCES public.nature_reserves(source_id) ON DELETE CASCADE,
    source_record_id text,
    data_group text,
    source_field text,
    source_file_id text,
    file_name text,
    mime_type text,
    file_size_bytes bigint,
    source_file_updated_at date,
    source_url text,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nature_reserves_name ON public.nature_reserves(name);
CREATE INDEX IF NOT EXISTS idx_nature_reserves_type ON public.nature_reserves(reserve_type);
CREATE INDEX IF NOT EXISTS idx_nature_reserves_province ON public.nature_reserves(province);
CREATE INDEX IF NOT EXISTS idx_nature_reserves_geo ON public.nature_reserves(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_nature_reserves_search
    ON public.nature_reserves
    USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(reserve_type, '') || ' ' || coalesce(province, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_nature_reserve_documents_reserve ON public.nature_reserve_documents(reserve_source_id);
CREATE INDEX IF NOT EXISTS idx_nature_reserve_ecosystems_reserve ON public.nature_reserve_ecosystems(reserve_source_id);
CREATE INDEX IF NOT EXISTS idx_nature_reserve_species_inventories_reserve ON public.nature_reserve_species_inventories(reserve_source_id);
CREATE INDEX IF NOT EXISTS idx_nature_reserve_genetic_resources_reserve ON public.nature_reserve_genetic_resources(reserve_source_id);
CREATE INDEX IF NOT EXISTS idx_nature_reserve_files_reserve ON public.nature_reserve_files(reserve_source_id);
CREATE INDEX IF NOT EXISTS idx_nature_reserve_files_source_url ON public.nature_reserve_files(source_url);

COMMIT;
