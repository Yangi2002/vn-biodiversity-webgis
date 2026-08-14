import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FungiSpeciesRepository } from './sources/fungi-species.repository';
import type { SpeciesSourceTable } from './types/species-source.type';
import type {
  SpeciesFacetItem,
  SpeciesImageResult,
  SpeciesSearchFacets,
  SpeciesSearchFilters,
  SpeciesSearchResult,
} from './types/species-search-result.type';
import type {
  SpeciesDetailField,
  SpeciesDetailImage,
  SpeciesDetailResult,
  SpeciesConservationSummary,
  SpeciesKeywordReference,
  SpeciesTaxonomyNode,
} from './types/species-detail-result.type';

interface SpeciesSearchRow {
  source_table: SpeciesSourceTable;
  source_label: string;
  species_id: string;
  vietnamese_name: string | null;
  scientific_name: string | null;
  family: string | null;
  order_name: string | null;
  class_name: string | null;
  genus_name: string | null;
  title_block: string | null;
  image_url: string | null;
  image_mime_type: string | null;
}

interface CountRow {
  total: bigint | number;
}

interface ImageRow {
  image_data: Uint8Array;
  mime_type: string | null;
}

interface SpeciesImageRow {
  image_order: number;
  image_source: string;
  image_source_table: SpeciesSourceTable;
  image_species_id: string;
  image_source_rank: number;
  has_species_image_data: boolean | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: bigint | number | null;
  showpic_id: bigint | number | null;
  showpic_has_image_data: boolean | null;
  showpic_vietname: string | null;
  showpic_latinname: string | null;
  showpic_author: string | null;
  showpic_source_image_url: string | null;
  showpic_thumbnail_url: string | null;
  showpic_imagepath: string | null;
  showpic_image_local_path: string | null;
  showpic_image_mime_type: string | null;
  showpic_image_file_size: bigint | number | null;
  showpic_image_width: number | null;
  showpic_image_height: number | null;
  showpic_fetch_status: string | null;
  showpic_error_message: string | null;
  showpic_url: string | null;
  showpic_fetched_at: Date | string | null;
  showpic_created_at: Date | string | null;
  showpic_updated_at: Date | string | null;
}

interface TaxonomyPathRow {
  taxon_id: bigint | number;
  rank: string;
  canonical_name: string;
  vietnamese_name: string | null;
}

interface KeywordReferenceRow {
  keyword_id: bigint | number;
  keyword_text: string;
  keyword_text_in_detail: string;
  section_name: string | null;
  detail_url: string;
  keyword_url: string;
  page_title: string | null;
  description_text: string | null;
  source_type: string;
  fetch_status: string;
}

interface KeywordImageRow {
  keyword_id: bigint | number;
  image_order: number;
  mime_type: string | null;
}

interface ConservationTermRow {
  term_id: bigint | number;
  term_text: string;
  term_type: string;
  category_code: string | null;
  criteria_code: string | null;
  severity_order: number | null;
  source_field: string | null;
  matched_text: string | null;
  context: string | null;
}

interface VnRedListProfileRow {
  profile_id: bigint | number;
  page_url: string;
  scientific_name: string | null;
  vietnamese_name: string | null;
  page_title: string | null;
  redlist_category: string | null;
  redlist_criteria: string | null;
  published_year: string | null;
  assessor: string | null;
  contributors: string | null;
  distribution_vietnam: string | null;
  distribution_world: string | null;
  habitat: string | null;
  threats: string | null;
  conservation_status: string | null;
  conservation_measures_existing: string | null;
  conservation_measures_proposed: string | null;
  representative_image_url: string | null;
  match_method: string | null;
  confidence: number | null;
}

interface FacetRow {
  value: string | null;
  label: string | null;
  total: bigint | number;
}

interface FacetUnionRow extends FacetRow {
  facet_name: 'sourceTables' | 'kingdoms' | 'classNames' | 'orders' | 'families' | 'genera';
}

type SpeciesDetailRow = Record<string, string | null>;

const SOURCE_TABLE_LABELS: Record<SpeciesSourceTable, string> = {
  animal_db_vn: 'Động vật',
  plant_db_vn: 'Thực vật',
  insect_db_vn: 'Côn trùng',
  fungi_db_vn: 'Nấm',
};

const DETAIL_FIELD_LABELS: Record<string, string> = {
  source_loai: 'Nguồn loài',
  species_id: 'Mã loài',
  page: 'Trang nguồn',
  hinh: 'Ảnh nguồn',
  ten_viet_nam: 'Tên Việt Nam',
  ten_latin: 'Tên khoa học',
  ho: 'Họ',
  bo: 'Bộ',
  lop_nhom: 'Lớp / nhóm',
  title_block: 'Khối tiêu đề',
  dac_diem_nhan_dang: 'Đặc điểm nhận dạng',
  dac_diem_bo_sung: 'Đặc điểm bổ sung',
  kich_thuoc: 'Kích thước',
  mau_mo_ta: 'Màu sắc mô tả',
  sinh_hoc_sinh_thai: 'Sinh học - sinh thái',
  phan_bo: 'Phân bố',
  phan_hang: 'Phân hạng',
  gia_tri: 'Giá trị',
  tinh_trang: 'Tình trạng',
  bien_phap_bao_ve: 'Biện pháp bảo vệ',
  tai_lieu_dan: 'Tài liệu dẫn',
  cong_dung: 'Công dụng',
  mo_ta: 'Mô tả',
  mo_ta_loai: 'Mô tả loài',
  ban_do_phan_bo_cua_loai: 'Bản đồ phân bố của loài',
  list_ten_viet_nam: 'Danh sách tên Việt Nam',
  list_ten_latin: 'Danh sách tên khoa học',
  ten_tieng_anh: 'Tên tiếng Anh',
  dong_danh: 'Đồng danh',
  ten_khac: 'Tên khác',
  gioi: 'Giới',
  nganh: 'Ngành',
  lop: 'Lớp',
  do_cao: 'Độ cao',
  ma_dinh_danh: 'Mã định danh',
  xac_dinh_boi: 'Xác định bởi',
  moi_truong_song: 'Môi trường sống',
  sinh_thai: 'Sinh thái',
};

const HIDDEN_DETAIL_FIELD_KEYS = new Set([
  'detail_url',
  'hinh',
  'image_url',
  'image_mime_type',
  'source_table',
  'source_slug',
  'source_post_url',
]);

const SPECIES_UNION_SQL = `
  SELECT
    'animal_db_vn'::text AS source_table,
    'Động vật'::text AS source_label,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name,
    ho AS family,
    bo AS order_name,
    lop_nhom AS class_name,
    nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
    title_block,
    coalesce(title_block, '') AS search_text
  FROM animal_db_vn
  UNION ALL
  SELECT
    'plant_db_vn'::text AS source_table,
    'Thực vật'::text AS source_label,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name,
    ho AS family,
    bo AS order_name,
    lop_nhom AS class_name,
    nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
    title_block,
    coalesce(title_block, '') AS search_text
  FROM plant_db_vn
  UNION ALL
  SELECT
    'insect_db_vn'::text AS source_table,
    'Côn trùng'::text AS source_label,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name,
    ho AS family,
    bo AS order_name,
    lop_nhom AS class_name,
    nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
    title_block,
    coalesce(title_block, '') AS search_text
  FROM insect_db_vn
  UNION ALL
  SELECT
    'fungi_db_vn'::text AS source_table,
    'Nấm'::text AS source_label,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name,
    ho AS family,
    bo AS order_name,
    lop_nhom AS class_name,
    nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
    title_block,
    concat_ws(' ', title_block, dong_danh, ten_khac, ten_tieng_anh) AS search_text
  FROM fungi_db_vn
`;

const SPECIES_ENRICHED_CTE_SQL = `
  species_union AS (${SPECIES_UNION_SQL}),
  species_enriched AS (
    SELECT
      species_union.*,
      coalesce(taxonomy_source.effective_source_table, species_union.source_table) AS effective_source_table,
      coalesce(taxonomy_source.effective_source_label, species_union.source_label) AS effective_source_label,
      taxonomy_source.kingdom_name
    FROM species_union
    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'plantae') THEN 'plant_db_vn'
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'fungi') THEN 'fungi_db_vn'
          WHEN bool_or(parent.rank = 'class' AND lower(parent.canonical_name) = 'insecta') THEN 'insect_db_vn'
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'animalia') THEN 'animal_db_vn'
          ELSE NULL
        END AS effective_source_table,
        CASE
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'plantae') THEN 'Thực vật'
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'fungi') THEN 'Nấm'
          WHEN bool_or(parent.rank = 'class' AND lower(parent.canonical_name) = 'insecta') THEN 'Côn trùng'
          WHEN bool_or(parent.rank = 'kingdom' AND lower(parent.canonical_name) = 'animalia') THEN 'Động vật'
          ELSE NULL
        END AS effective_source_label
        ,
        max(parent.canonical_name) FILTER (WHERE parent.rank = 'kingdom') AS kingdom_name
      FROM species_taxonomy st
      JOIN taxon_closure tc
        ON tc.descendant_taxon_id = st.taxon_id
      JOIN taxa parent
        ON parent.taxon_id = tc.ancestor_taxon_id
      WHERE st.source_table = species_union.source_table
        AND st.species_id = species_union.species_id
    ) taxonomy_source ON true
  )
`;

const SEARCH_FILTER_SQL = `
  (
    $1 = ''
    OR lower(coalesce(species_id, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(vietnamese_name, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(scientific_name, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(family, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(order_name, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(class_name, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(genus_name, '')) LIKE lower('%' || $1 || '%')
    OR lower(coalesce(search_text, '')) LIKE lower('%' || $1 || '%')
  )
`;

const FUNGI_DUPLICATE_SUPPRESSION_SQL = `
  NOT (
    species_enriched.source_table <> 'fungi_db_vn'
    AND EXISTS (
      SELECT 1
      FROM fungi_db_vn fungi_duplicate
      WHERE (
        nullif(regexp_replace(lower(coalesce(fungi_duplicate.ten_viet_nam, '')), '\\s+', '', 'g'), '')
          = nullif(regexp_replace(lower(coalesce(species_enriched.vietnamese_name, '')), '\\s+', '', 'g'), '')
        OR nullif(regexp_replace(lower(coalesce(fungi_duplicate.ten_latin, '')), '[^a-z0-9]+', '', 'g'), '')
          = nullif(regexp_replace(lower(coalesce(species_enriched.scientific_name, '')), '[^a-z0-9]+', '', 'g'), '')
      )
    )
  )
`;

const DIRECT_SPECIES_DEDUP_CTE_SQL = `
  direct_species AS (
    ${SPECIES_UNION_SQL}
  ),
  direct_species_normalized AS (
    SELECT
      direct_species.*,
      nullif(regexp_replace(lower(coalesce(vietnamese_name, '')), '\\s+', '', 'g'), '') AS vietnamese_key,
      nullif(regexp_replace(lower(coalesce(scientific_name, '')), '[^a-z0-9]+', '', 'g'), '') AS scientific_key
    FROM direct_species
  ),
  fungi_duplicate_keys AS MATERIALIZED (
    SELECT DISTINCT
      nullif(regexp_replace(lower(coalesce(ten_viet_nam, '')), '\\s+', '', 'g'), '') AS vietnamese_key,
      nullif(regexp_replace(lower(coalesce(ten_latin, '')), '[^a-z0-9]+', '', 'g'), '') AS scientific_key
    FROM fungi_db_vn
  ),
  deduped_species AS (
    SELECT direct_species_normalized.*
    FROM direct_species_normalized
    LEFT JOIN fungi_duplicate_keys fungi_vietnamese
      ON direct_species_normalized.source_table <> 'fungi_db_vn'
     AND direct_species_normalized.vietnamese_key IS NOT NULL
     AND fungi_vietnamese.vietnamese_key = direct_species_normalized.vietnamese_key
    LEFT JOIN fungi_duplicate_keys fungi_scientific
      ON direct_species_normalized.source_table <> 'fungi_db_vn'
     AND direct_species_normalized.scientific_key IS NOT NULL
     AND fungi_scientific.scientific_key = direct_species_normalized.scientific_key
    WHERE direct_species_normalized.source_table = 'fungi_db_vn'
       OR (
        fungi_vietnamese.vietnamese_key IS NULL
        AND fungi_scientific.scientific_key IS NULL
      )
  )
`;

const SPECIES_ALIAS_CTE_SQL = `
  species_aliases AS (
    SELECT $1::text AS source_table, $2::text AS species_id, 0 AS match_rank
    UNION
    SELECT duplicate_species.source_table, duplicate_species.species_id, 1 AS match_rank
    FROM fungi_db_vn fungi_species
    JOIN (
      SELECT 'animal_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
      FROM animal_db_vn
      UNION ALL
      SELECT 'plant_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
      FROM plant_db_vn
      UNION ALL
      SELECT 'insect_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
      FROM insect_db_vn
    ) duplicate_species
      ON (
        nullif(regexp_replace(lower(coalesce(fungi_species.ten_viet_nam, '')), '\\s+', '', 'g'), '')
          = nullif(regexp_replace(lower(coalesce(duplicate_species.vietnamese_name, '')), '\\s+', '', 'g'), '')
        OR nullif(regexp_replace(lower(coalesce(fungi_species.ten_latin, '')), '[^a-z0-9]+', '', 'g'), '')
          = nullif(regexp_replace(lower(coalesce(duplicate_species.scientific_name, '')), '[^a-z0-9]+', '', 'g'), '')
      )
    WHERE (
        $1::text = 'fungi_db_vn'
        AND fungi_species.species_id = $2::text
      )
      OR (
        duplicate_species.source_table = $1::text
        AND duplicate_species.species_id = $2::text
      )
  )
`;

interface FilterSql {
  whereSql: string;
  values: unknown[];
}

@Injectable()
export class SpeciesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fungiSpeciesRepository: FungiSpeciesRepository,
  ) {}

  async search(
    query: string,
    filters: SpeciesSearchFilters,
    limit: number,
    offset: number,
  ): Promise<SpeciesSearchResult[]> {
    if (this.fungiSpeciesRepository.canHandleFastList(filters)) {
      return this.fungiSpeciesRepository.search(query, filters, limit, offset);
    }

    if (this.canUseDirectListPath(filters)) {
      return this.searchDirect(query, filters, limit, offset);
    }

    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<SpeciesSearchRow[]>(
      `
        WITH ${SPECIES_ENRICHED_CTE_SQL},
        filtered_species AS (
          SELECT *
          FROM species_enriched
          WHERE ${SEARCH_FILTER_SQL}
            AND ${FUNGI_DUPLICATE_SUPPRESSION_SQL}
            ${filterSql.whereSql}
        ),
        paged_species AS (
          SELECT *
          FROM filtered_species
          ORDER BY
            CASE WHEN vietnamese_name IS NULL OR vietnamese_name = '' THEN 1 ELSE 0 END,
            vietnamese_name ASC NULLS LAST,
            scientific_name ASC NULLS LAST
          LIMIT $${filterSql.values.length + 2} OFFSET $${filterSql.values.length + 3}
        )
        SELECT
          species_enriched.source_table,
          species_enriched.effective_source_label AS source_label,
          species_enriched.species_id,
          species_enriched.vietnamese_name,
          species_enriched.scientific_name,
          species_enriched.family,
          species_enriched.order_name,
          species_enriched.class_name,
          species_enriched.genus_name,
          species_enriched.title_block,
          CASE
            WHEN species_image.image_order IS NULL THEN NULL
            WHEN species_image.image_source = 'showpic'
              THEN '/species/' || species_image.image_source_table || '/' || species_image.image_species_id || '/showpic-images/' || species_image.image_order
            ELSE '/species/' || species_enriched.source_table || '/' || species_enriched.species_id || '/image'
          END AS image_url,
          species_image.mime_type AS image_mime_type
        FROM paged_species species_enriched
        LEFT JOIN LATERAL (
          WITH species_aliases AS (
            SELECT species_enriched.source_table, species_enriched.species_id, 0 AS match_rank
            UNION
            SELECT duplicate_species.source_table, duplicate_species.species_id, 1 AS match_rank
            FROM fungi_db_vn fungi_species
            JOIN (
              SELECT 'animal_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
              FROM animal_db_vn
              UNION ALL
              SELECT 'plant_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
              FROM plant_db_vn
              UNION ALL
              SELECT 'insect_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name, ten_latin AS scientific_name
              FROM insect_db_vn
            ) duplicate_species
              ON (
                nullif(regexp_replace(lower(coalesce(fungi_species.ten_viet_nam, '')), '\\s+', '', 'g'), '')
                  = nullif(regexp_replace(lower(coalesce(duplicate_species.vietnamese_name, '')), '\\s+', '', 'g'), '')
                OR nullif(regexp_replace(lower(coalesce(fungi_species.ten_latin, '')), '[^a-z0-9]+', '', 'g'), '')
                  = nullif(regexp_replace(lower(coalesce(duplicate_species.scientific_name, '')), '[^a-z0-9]+', '', 'g'), '')
              )
            WHERE (
                species_enriched.source_table = 'fungi_db_vn'
                AND fungi_species.species_id = species_enriched.species_id
              )
              OR (
                duplicate_species.source_table = species_enriched.source_table
                AND duplicate_species.species_id = species_enriched.species_id
              )
          )
          SELECT image_order, image_source, image_source_table, image_species_id, image_source_rank, match_rank, mime_type, width, height, size_bytes
          FROM (
            SELECT
              species_image.image_order,
              'species'::text AS image_source,
              species_image.source_table AS image_source_table,
              species_image.species_id AS image_species_id,
              2 AS image_source_rank,
              species_aliases.match_rank,
              species_image.mime_type,
              species_image.width,
              species_image.height,
              octet_length(species_image.image_data) AS size_bytes
            FROM species_images species_image
            JOIN species_aliases
              ON species_aliases.source_table = species_image.source_table
             AND species_aliases.species_id = species_image.species_id
            UNION ALL
            SELECT
              showpic.image_order,
              'showpic'::text AS image_source,
              showpic.source_table AS image_source_table,
              showpic.species_id AS image_species_id,
              CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
              0 AS match_rank,
              showpic.image_mime_type AS mime_type,
              showpic.image_width AS width,
              showpic.image_height AS height,
              showpic.image_file_size AS size_bytes
            FROM species_showpic_metadata showpic
            JOIN species_aliases
              ON species_aliases.source_table = showpic.source_table
             AND species_aliases.species_id = showpic.species_id
            WHERE showpic.image_data IS NOT NULL
          ) candidate_image
          ORDER BY
            match_rank ASC,
            image_source_rank ASC,
            image_order ASC
          LIMIT 1
        ) species_image ON true
        ORDER BY
          CASE WHEN species_enriched.vietnamese_name IS NULL OR species_enriched.vietnamese_name = '' THEN 1 ELSE 0 END,
          species_enriched.vietnamese_name ASC NULLS LAST,
          species_enriched.scientific_name ASC NULLS LAST
      `,
      query,
      ...filterSql.values,
      limit,
      offset,
    );

    return rows.map((row) => ({
      sourceTable: row.source_table,
      sourceLabel: row.source_label,
      speciesId: row.species_id,
      vietnameseName: row.vietnamese_name,
      scientificName: row.scientific_name,
      family: row.family,
      order: row.order_name,
      className: row.class_name,
      genus: row.genus_name,
      titleBlock: row.title_block,
      imageUrl: row.image_url,
      imageMimeType: row.image_mime_type,
    }));
  }

  async count(query: string, filters: SpeciesSearchFilters): Promise<number> {
    if (this.fungiSpeciesRepository.canHandleFastList(filters)) {
      return this.fungiSpeciesRepository.count(query, filters);
    }

    if (this.canUseDirectListPath(filters)) {
      return this.countDirect(query, filters);
    }

    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        WITH ${SPECIES_ENRICHED_CTE_SQL}
        SELECT count(*) AS total
        FROM species_enriched
        WHERE ${SEARCH_FILTER_SQL}
          AND ${FUNGI_DUPLICATE_SUPPRESSION_SQL}
          ${filterSql.whereSql}
      `,
      query,
      ...filterSql.values,
    );

    return Number(rows[0]?.total ?? 0);
  }

  async facets(query: string, filters: SpeciesSearchFilters): Promise<SpeciesSearchFacets> {
    if (this.fungiSpeciesRepository.canHandleFastList(filters)) {
      return this.fungiSpeciesRepository.facets(query, filters);
    }

    if (this.canUseDirectListPath(filters)) {
      return this.facetsDirect(query, filters);
    }

    return this.facetsUnion(query, filters);
  }

  async findDetail(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesDetailResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<SpeciesDetailRow[]>(
      `
        SELECT
          species.*,
          CASE
            WHEN species_image.image_order IS NULL THEN NULL
            WHEN species_image.image_source = 'showpic'
              THEN '/species/' || species_image.image_source_table || '/' || species_image.image_species_id || '/showpic-images/' || species_image.image_order
            ELSE '/species/' || $1 || '/' || species.species_id || '/image'
          END AS image_url,
          species_image.mime_type AS image_mime_type
        FROM ${sourceTable} species
        LEFT JOIN LATERAL (
          SELECT image_order, image_source, image_source_table, image_species_id, image_source_rank, match_rank, mime_type, width, height, size_bytes
          FROM (
            SELECT
              image_order,
              'species'::text AS image_source,
              $1::text AS image_source_table,
              species.species_id AS image_species_id,
              2 AS image_source_rank,
              0 AS match_rank,
              mime_type,
              width,
              height,
              octet_length(image_data) AS size_bytes
            FROM species_images
            WHERE source_table = $1
              AND species_id = species.species_id
            UNION ALL
            SELECT
              showpic.image_order,
              'showpic'::text AS image_source,
              showpic.source_table AS image_source_table,
              showpic.species_id AS image_species_id,
              CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
              0 AS match_rank,
              showpic.image_mime_type AS mime_type,
              showpic.image_width AS width,
              showpic.image_height AS height,
              showpic.image_file_size AS size_bytes
            FROM species_showpic_metadata showpic
            WHERE showpic.source_table = $1
              AND showpic.image_data IS NOT NULL
              AND showpic.species_id = species.species_id
          ) candidate_image
          ORDER BY
            image_source_rank ASC,
            match_rank ASC,
            image_order ASC
          LIMIT 1
        ) species_image ON true
        WHERE species.species_id = $2
        LIMIT 1
      `,
      sourceTable,
      speciesId,
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    const [images, taxonomyPath, keywords, conservation] = await Promise.all([
      this.findImageList(sourceTable, speciesId),
      this.findTaxonomyPath(sourceTable, speciesId),
      this.findKeywordReferences(sourceTable, speciesId),
      this.findConservationSummary(sourceTable, speciesId),
    ]);

    return {
      sourceTable,
      sourceLabel: this.resolveSourceLabel(sourceTable, taxonomyPath),
      speciesId: row.species_id ?? speciesId,
      vietnameseName: row.ten_viet_nam,
      scientificName: row.ten_latin,
      family: row.ho,
      order: row.bo,
      className: row.lop_nhom,
      titleBlock: this.formatTitleBlock(row),
      imageUrl: images[0]?.imageUrl ?? row.image_url,
      imageMimeType: images[0]?.mimeType ?? row.image_mime_type,
      images,
      taxonomyPath,
      keywords,
      conservation,
      fields: this.mapDetailFields(row),
    };
  }

  async findPrimaryImage(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesImageResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<ImageRow[]>(
      `
        WITH ${SPECIES_ALIAS_CTE_SQL}
        SELECT image_data, mime_type
        FROM (
          SELECT
            species_image.image_data,
            species_image.mime_type,
            species_image.width,
            species_image.height,
            octet_length(species_image.image_data) AS size_bytes,
            'species'::text AS image_source,
            species_image.image_order,
            2 AS image_source_rank,
            species_aliases.match_rank
          FROM species_images species_image
          JOIN species_aliases
            ON species_aliases.source_table = species_image.source_table
           AND species_aliases.species_id = species_image.species_id
          UNION ALL
          SELECT
            showpic.image_data,
            showpic.image_mime_type AS mime_type,
            showpic.image_width AS width,
            showpic.image_height AS height,
            showpic.image_file_size AS size_bytes,
            'showpic'::text AS image_source,
            showpic.image_order,
            CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
            species_aliases.match_rank
          FROM species_showpic_metadata showpic
          JOIN species_aliases
            ON species_aliases.source_table = showpic.source_table
           AND species_aliases.species_id = showpic.species_id
          WHERE showpic.image_data IS NOT NULL
        ) candidate_image
        ORDER BY
          match_rank ASC,
          image_source_rank ASC,
          image_order ASC
        LIMIT 1
      `,
      sourceTable,
      speciesId,
    );

    const image = rows[0];

    if (!image) {
      return null;
    }

    return {
      imageData: image.image_data,
      mimeType: image.mime_type ?? 'image/jpeg',
    };
  }

  async findImageByOrder(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
    imageOrder: number,
  ): Promise<SpeciesImageResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<ImageRow[]>(
      `
        SELECT image_data, mime_type
        FROM species_images
        WHERE source_table = $1
          AND species_id = $2
          AND image_order = $3
        LIMIT 1
      `,
      sourceTable,
      speciesId,
      imageOrder,
    );

    const image = rows[0];

    if (!image) {
      return null;
    }

    return {
      imageData: image.image_data,
      mimeType: image.mime_type ?? 'image/jpeg',
    };
  }

  async findShowpicImageByOrder(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
    imageOrder: number,
  ): Promise<SpeciesImageResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<ImageRow[]>(
      `
        SELECT image_data, image_mime_type AS mime_type
        FROM species_showpic_metadata
        WHERE source_table = $1
          AND species_id = $2
          AND image_order = $3
          AND image_data IS NOT NULL
        LIMIT 1
      `,
      sourceTable,
      speciesId,
      imageOrder,
    );

    const image = rows[0];

    if (!image) {
      return null;
    }

    return {
      imageData: image.image_data,
      mimeType: image.mime_type ?? 'image/jpeg',
    };
  }

  async findKeywordImageByOrder(keywordId: string, imageOrder: number): Promise<SpeciesImageResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<ImageRow[]>(
      `
        SELECT image_data, mime_type
        FROM site_keyword_images
        WHERE keyword_id = $1::bigint
          AND image_order = $2
        LIMIT 1
      `,
      keywordId,
      imageOrder,
    );

    const image = rows[0];

    if (!image) {
      return null;
    }

    return {
      imageData: image.image_data,
      mimeType: image.mime_type ?? 'image/jpeg',
    };
  }

  private canUseDirectListPath(filters: SpeciesSearchFilters): boolean {
    return !filters.kingdom && !filters.taxonId;
  }

  private async searchDirect(
    query: string,
    filters: SpeciesSearchFilters,
    limit: number,
    offset: number,
  ): Promise<SpeciesSearchResult[]> {
    const filterSql = this.buildDirectFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<SpeciesSearchRow[]>(
      `
        WITH ${DIRECT_SPECIES_DEDUP_CTE_SQL},
        filtered_species AS (
          SELECT *
          FROM deduped_species
          WHERE ${SEARCH_FILTER_SQL}
            ${filterSql.whereSql}
        ),
        paged_species AS (
          SELECT *
          FROM filtered_species
          ORDER BY
            CASE WHEN vietnamese_name IS NULL OR vietnamese_name = '' THEN 1 ELSE 0 END,
            vietnamese_name ASC NULLS LAST,
            scientific_name ASC NULLS LAST
          LIMIT $${filterSql.values.length + 2} OFFSET $${filterSql.values.length + 3}
        ),
        image_candidates AS (
          SELECT
            paged_species.source_table,
            paged_species.species_id,
            species_image.image_order,
            'species'::text AS image_source,
            species_image.source_table AS image_source_table,
            species_image.species_id AS image_species_id,
            2 AS image_source_rank,
            species_image.mime_type
          FROM paged_species
          JOIN species_images species_image
            ON species_image.source_table = paged_species.source_table
           AND species_image.species_id = paged_species.species_id
          UNION ALL
          SELECT
            paged_species.source_table,
            paged_species.species_id,
            showpic.image_order,
            'showpic'::text AS image_source,
            showpic.source_table AS image_source_table,
            showpic.species_id AS image_species_id,
            CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
            showpic.image_mime_type AS mime_type
          FROM paged_species
          JOIN species_showpic_metadata showpic
            ON showpic.source_table = paged_species.source_table
           AND showpic.species_id = paged_species.species_id
          WHERE showpic.image_data IS NOT NULL
        ),
        ranked_images AS (
          SELECT
            image_candidates.*,
            row_number() OVER (
              PARTITION BY source_table, species_id
              ORDER BY image_source_rank ASC, image_order ASC
            ) AS image_rank
          FROM image_candidates
        )
        SELECT
          species.source_table,
          species.source_label,
          species.species_id,
          species.vietnamese_name,
          species.scientific_name,
          species.family,
          species.order_name,
          species.class_name,
          species.genus_name,
          species.title_block,
          CASE
            WHEN species_image.image_order IS NULL THEN NULL
            WHEN species_image.image_source = 'showpic'
              THEN '/species/' || species_image.image_source_table || '/' || species_image.image_species_id || '/showpic-images/' || species_image.image_order
            ELSE '/species/' || species_image.image_source_table || '/' || species_image.image_species_id || '/image'
          END AS image_url,
          species_image.mime_type AS image_mime_type
        FROM paged_species species
        LEFT JOIN ranked_images species_image
          ON species_image.source_table = species.source_table
         AND species_image.species_id = species.species_id
         AND species_image.image_rank = 1
        ORDER BY
          CASE WHEN species.vietnamese_name IS NULL OR species.vietnamese_name = '' THEN 1 ELSE 0 END,
          species.vietnamese_name ASC NULLS LAST,
          species.scientific_name ASC NULLS LAST
      `,
      query,
      ...filterSql.values,
      limit,
      offset,
    );

    return rows.map((row) => ({
      sourceTable: row.source_table,
      sourceLabel: row.source_label,
      speciesId: row.species_id,
      vietnameseName: row.vietnamese_name,
      scientificName: row.scientific_name,
      family: row.family,
      order: row.order_name,
      className: row.class_name,
      genus: row.genus_name,
      titleBlock: row.title_block,
      imageUrl: row.image_url,
      imageMimeType: row.image_mime_type,
    }));
  }

  private async countDirect(query: string, filters: SpeciesSearchFilters): Promise<number> {
    const filterSql = this.buildDirectFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        WITH ${DIRECT_SPECIES_DEDUP_CTE_SQL}
        SELECT count(*) AS total
        FROM deduped_species
        WHERE ${SEARCH_FILTER_SQL}
          ${filterSql.whereSql}
      `,
      query,
      ...filterSql.values,
    );

    return Number(rows[0]?.total ?? 0);
  }

  private async facetsDirect(query: string, filters: SpeciesSearchFilters): Promise<SpeciesSearchFacets> {
    const filterSql = this.buildDirectFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<FacetUnionRow[]>(
      `
        WITH ${DIRECT_SPECIES_DEDUP_CTE_SQL},
        filtered_species AS (
          SELECT *
          FROM deduped_species
          WHERE ${SEARCH_FILTER_SQL}
            ${filterSql.whereSql}
        ),
        facet_source_tables AS (
          SELECT 'sourceTables'::text AS facet_name, source_table AS value, min(source_label) AS label, count(*) AS total
          FROM filtered_species
          GROUP BY source_table
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        kingdom_species AS (
          SELECT
            filtered_species.source_table,
            filtered_species.species_id,
            coalesce(
              taxonomy_kingdom.kingdom_name,
              CASE
                WHEN filtered_species.source_table = 'plant_db_vn' THEN 'Plantae'
                WHEN filtered_species.source_table = 'fungi_db_vn' THEN 'Fungi'
                ELSE 'Animalia'
              END
            ) AS kingdom_name
          FROM filtered_species
          LEFT JOIN LATERAL (
            SELECT parent.canonical_name AS kingdom_name
            FROM species_taxonomy st
            JOIN taxon_closure tc
              ON tc.descendant_taxon_id = st.taxon_id
            JOIN taxa parent
              ON parent.taxon_id = tc.ancestor_taxon_id
            WHERE st.source_table = filtered_species.source_table
              AND st.species_id = filtered_species.species_id
              AND parent.rank = 'kingdom'
            ORDER BY
              CASE lower(parent.canonical_name)
                WHEN 'animalia' THEN 1
                WHEN 'plantae' THEN 2
                WHEN 'fungi' THEN 3
                WHEN 'chromista' THEN 4
                ELSE 5
              END
            LIMIT 1
          ) taxonomy_kingdom ON true
        ),
        facet_kingdoms AS (
          SELECT
            'kingdoms'::text AS facet_name,
            kingdom_name AS value,
            CASE
              WHEN lower(kingdom_name) = 'animalia' THEN 'Động vật - Animalia'
              WHEN lower(kingdom_name) = 'plantae' THEN 'Thực vật - Plantae'
              WHEN lower(kingdom_name) = 'fungi' THEN 'Nấm - Fungi'
              WHEN lower(kingdom_name) = 'chromista' THEN 'Sinh vật nguyên sinh - Chromista'
              ELSE kingdom_name
            END AS label,
            count(*) AS total
          FROM kingdom_species
          GROUP BY value, label
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_class_names AS (
          SELECT 'classNames'::text AS facet_name, class_name AS value, min(class_name) AS label, count(*) AS total
          FROM filtered_species
          WHERE class_name IS NOT NULL AND class_name <> ''
          GROUP BY class_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_orders AS (
          SELECT 'orders'::text AS facet_name, order_name AS value, min(order_name) AS label, count(*) AS total
          FROM filtered_species
          WHERE order_name IS NOT NULL AND order_name <> ''
          GROUP BY order_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_families AS (
          SELECT 'families'::text AS facet_name, family AS value, min(family) AS label, count(*) AS total
          FROM filtered_species
          WHERE family IS NOT NULL AND family <> ''
          GROUP BY family
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_genera AS (
          SELECT 'genera'::text AS facet_name, genus_name AS value, min(genus_name) AS label, count(*) AS total
          FROM filtered_species
          WHERE genus_name IS NOT NULL AND genus_name <> ''
          GROUP BY genus_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        )
        SELECT * FROM facet_source_tables
        UNION ALL SELECT * FROM facet_kingdoms
        UNION ALL SELECT * FROM facet_class_names
        UNION ALL SELECT * FROM facet_orders
        UNION ALL SELECT * FROM facet_families
        UNION ALL SELECT * FROM facet_genera
      `,
      query,
      ...filterSql.values,
    );

    const facets: SpeciesSearchFacets = {
      sourceTables: [],
      kingdoms: [],
      classNames: [],
      orders: [],
      families: [],
      genera: [],
    };

    for (const row of rows) {
      const value = row.value ?? '';
      facets[row.facet_name].push({
        value,
        label: row.label ?? value,
        count: Number(row.total),
      });
    }

    return facets;
  }

  private async facetsUnion(query: string, filters: SpeciesSearchFilters): Promise<SpeciesSearchFacets> {
    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<FacetUnionRow[]>(
      `
        WITH ${SPECIES_ENRICHED_CTE_SQL},
        filtered_species AS (
          SELECT *
          FROM species_enriched
          WHERE ${SEARCH_FILTER_SQL}
            AND ${FUNGI_DUPLICATE_SUPPRESSION_SQL}
            ${filterSql.whereSql}
        ),
        facet_source_tables AS (
          SELECT
            'sourceTables'::text AS facet_name,
            effective_source_table AS value,
            min(effective_source_label) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE effective_source_table IS NOT NULL AND effective_source_table <> ''
          GROUP BY effective_source_table
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_kingdoms AS (
          SELECT
            'kingdoms'::text AS facet_name,
            kingdom_name AS value,
            min(kingdom_name) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE kingdom_name IS NOT NULL AND kingdom_name <> ''
          GROUP BY kingdom_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_class_names AS (
          SELECT
            'classNames'::text AS facet_name,
            class_name AS value,
            min(class_name) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE class_name IS NOT NULL AND class_name <> ''
          GROUP BY class_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_orders AS (
          SELECT
            'orders'::text AS facet_name,
            order_name AS value,
            min(order_name) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE order_name IS NOT NULL AND order_name <> ''
          GROUP BY order_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_families AS (
          SELECT
            'families'::text AS facet_name,
            family AS value,
            min(family) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE family IS NOT NULL AND family <> ''
          GROUP BY family
          ORDER BY total DESC, value ASC
          LIMIT 40
        ),
        facet_genera AS (
          SELECT
            'genera'::text AS facet_name,
            genus_name AS value,
            min(genus_name) AS label,
            count(*) AS total
          FROM filtered_species
          WHERE genus_name IS NOT NULL AND genus_name <> ''
          GROUP BY genus_name
          ORDER BY total DESC, value ASC
          LIMIT 40
        )
        SELECT * FROM facet_source_tables
        UNION ALL SELECT * FROM facet_kingdoms
        UNION ALL SELECT * FROM facet_class_names
        UNION ALL SELECT * FROM facet_orders
        UNION ALL SELECT * FROM facet_families
        UNION ALL SELECT * FROM facet_genera
      `,
      query,
      ...filterSql.values,
    );

    const facets: SpeciesSearchFacets = {
      sourceTables: [],
      kingdoms: [],
      classNames: [],
      orders: [],
      families: [],
      genera: [],
    };

    for (const row of rows) {
      const value = row.value ?? '';
      facets[row.facet_name].push({
        value,
        label: row.facet_name === 'kingdoms' ? this.kingdomFacetLabel(value) : (row.label ?? value),
        count: Number(row.total),
      });
    }

    return facets;
  }

  private async facet(
    query: string,
    filters: SpeciesSearchFilters,
    column: 'effective_source_table' | 'kingdom_name' | 'class_name' | 'order_name' | 'family' | 'genus_name',
    labelColumn:
      | 'effective_source_label'
      | 'effective_source_table'
      | 'kingdom_name'
      | 'class_name'
      | 'order_name'
      | 'family'
      | 'genus_name' = column,
  ): Promise<SpeciesFacetItem[]> {
    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<FacetRow[]>(
      `
        WITH ${SPECIES_ENRICHED_CTE_SQL}
        SELECT
          ${column} AS value,
          min(${labelColumn}) AS label,
          count(*) AS total
        FROM species_enriched
        WHERE ${SEARCH_FILTER_SQL}
          AND ${FUNGI_DUPLICATE_SUPPRESSION_SQL}
          ${filterSql.whereSql}
          AND ${column} IS NOT NULL
          AND ${column} <> ''
        GROUP BY ${column}
        ORDER BY total DESC, value ASC
        LIMIT 40
      `,
      query,
      ...filterSql.values,
    );

    return rows.map((row) => {
      const value = row.value ?? '';

      return {
        value,
        label: column === 'kingdom_name' ? this.kingdomFacetLabel(value) : (row.label ?? value),
        count: Number(row.total),
      };
    });
  }

  private kingdomFacetLabel(value: string): string {
    const normalized = value.trim().toLowerCase();
    const labels: Record<string, string> = {
      animalia: 'Động vật - Animalia',
      plantae: 'Thực vật - Plantae',
      fungi: 'Nấm - Fungi',
      chromista: 'Sinh vật nguyên sinh - Chromista',
      protista: 'Sinh vật nguyên sinh - Protista',
      bacteria: 'Vi khuẩn thật - Bacteria',
      archaea: 'Vi khuẩn cổ - Archaea',
    };

    return labels[normalized] ?? value;
  }

  private buildFilterSql(filters: SpeciesSearchFilters, startIndex: number): FilterSql {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.sourceTable) {
      values.push(filters.sourceTable);
      clauses.push(`AND effective_source_table = $${startIndex + values.length - 1}`);
    }

    if (filters.kingdom) {
      values.push(filters.kingdom);
      clauses.push(`AND kingdom_name = $${startIndex + values.length - 1}`);
    }

    if (filters.className) {
      values.push(filters.className);
      clauses.push(`AND class_name = $${startIndex + values.length - 1}`);
    }

    if (filters.order) {
      values.push(filters.order);
      clauses.push(`AND order_name = $${startIndex + values.length - 1}`);
    }

    if (filters.family) {
      values.push(filters.family);
      clauses.push(`AND family = $${startIndex + values.length - 1}`);
    }

    if (filters.genus) {
      values.push(filters.genus);
      clauses.push(`AND genus_name = $${startIndex + values.length - 1}`);
    }

    if (filters.taxonId) {
      values.push(filters.taxonId);
      clauses.push(`
        AND EXISTS (
          SELECT 1
          FROM species_taxonomy st
          JOIN taxon_closure tc
            ON tc.descendant_taxon_id = st.taxon_id
          WHERE st.source_table = species_enriched.source_table
            AND st.species_id = species_enriched.species_id
            AND tc.ancestor_taxon_id = $${startIndex + values.length - 1}::bigint
        )
      `);
    }

    return {
      whereSql: clauses.length ? `\n          ${clauses.join('\n          ')}` : '',
      values,
    };
  }

  private buildDirectFilterSql(filters: SpeciesSearchFilters, startIndex: number): FilterSql {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.sourceTable) {
      values.push(filters.sourceTable);
      clauses.push(`AND source_table = $${startIndex + values.length - 1}`);
    }

    if (filters.className) {
      values.push(filters.className);
      clauses.push(`AND class_name = $${startIndex + values.length - 1}`);
    }

    if (filters.order) {
      values.push(filters.order);
      clauses.push(`AND order_name = $${startIndex + values.length - 1}`);
    }

    if (filters.family) {
      values.push(filters.family);
      clauses.push(`AND family = $${startIndex + values.length - 1}`);
    }

    if (filters.genus) {
      values.push(filters.genus);
      clauses.push(`AND genus_name = $${startIndex + values.length - 1}`);
    }

    return {
      whereSql: clauses.length ? `\n          ${clauses.join('\n          ')}` : '',
      values,
    };
  }

  private mapDetailFields(row: SpeciesDetailRow): SpeciesDetailField[] {
    return Object.entries(row)
      .filter(([key]) => !HIDDEN_DETAIL_FIELD_KEYS.has(key))
      .map(([key, value]) => ({
        key,
        label: DETAIL_FIELD_LABELS[key] ?? key,
        value: key === 'title_block' ? this.formatTitleBlock(row) : this.normalizeDetailValue(key, value),
      }));
  }

  private formatTitleBlock(row: SpeciesDetailRow): string | null {
    const vietnameseName = this.normalizeDetailValue('ten_viet_nam', row.ten_viet_nam);
    const scientificName = this.normalizeDetailValue('ten_latin', row.ten_latin);
    const family = this.normalizeDetailValue('ho', row.ho);
    const order = this.normalizeDetailValue('bo', row.bo);
    const fallback = this.normalizeDetailValue('title_block', row.title_block);
    const lines = [
      vietnameseName?.toUpperCase(),
      scientificName,
      family ? `Họ: ${family}` : null,
      order ? `Bộ: ${order}` : null,
    ].filter((line): line is string => Boolean(line));

    return lines.length ? lines.join('\n') : fallback;
  }

  private async findImageList(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesDetailImage[]> {
    const rows = await this.prisma.$queryRawUnsafe<SpeciesImageRow[]>(
      `
        WITH ${SPECIES_ALIAS_CTE_SQL},
        image_candidates AS (
          SELECT
            species_image.image_order,
            'species'::text AS image_source,
            species_image.source_table AS image_source_table,
            species_image.species_id AS image_species_id,
            2 AS image_source_rank,
            species_aliases.match_rank
          FROM species_images species_image
          JOIN species_aliases
            ON species_aliases.source_table = species_image.source_table
           AND species_aliases.species_id = species_image.species_id
          UNION ALL
          SELECT
            showpic.image_order,
            'showpic'::text AS image_source,
            showpic.source_table AS image_source_table,
            showpic.species_id AS image_species_id,
            CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
            species_aliases.match_rank
          FROM species_showpic_metadata showpic
          JOIN species_aliases
            ON species_aliases.source_table = showpic.source_table
           AND species_aliases.species_id = showpic.species_id
          WHERE showpic.image_data IS NOT NULL
        ),
        ranked_images AS (
          SELECT
            image_candidates.*,
            row_number() OVER (
              PARTITION BY image_source_table, image_species_id, image_order
              ORDER BY
                match_rank ASC,
                image_source_rank ASC,
                image_source ASC
            ) AS image_rank
          FROM image_candidates
        )
        SELECT
          ranked_images.image_order,
          ranked_images.image_source,
          ranked_images.image_source_table,
          ranked_images.image_species_id,
          ranked_images.image_source_rank,
          (species_image.image_data IS NOT NULL) AS has_species_image_data,
          species_image.mime_type,
          species_image.width,
          species_image.height,
          CASE
            WHEN species_image.image_data IS NULL THEN NULL
            ELSE octet_length(species_image.image_data)
          END AS size_bytes,
          showpic.showpic_id,
          (showpic.image_data IS NOT NULL) AS showpic_has_image_data,
          showpic.vietname AS showpic_vietname,
          showpic.latinname AS showpic_latinname,
          showpic.author AS showpic_author,
          showpic.source_image_url AS showpic_source_image_url,
          showpic.thumbnail_url AS showpic_thumbnail_url,
          showpic.imagepath AS showpic_imagepath,
          showpic.image_local_path AS showpic_image_local_path,
          showpic.image_mime_type AS showpic_image_mime_type,
          showpic.image_file_size AS showpic_image_file_size,
          showpic.image_width AS showpic_image_width,
          showpic.image_height AS showpic_image_height,
          showpic.fetch_status AS showpic_fetch_status,
          showpic.error_message AS showpic_error_message,
          showpic.showpic_url,
          showpic.fetched_at AS showpic_fetched_at,
          showpic.created_at AS showpic_created_at,
          showpic.updated_at AS showpic_updated_at
        FROM ranked_images
        LEFT JOIN species_images species_image
          ON ranked_images.image_source = 'species'
         AND species_image.source_table = ranked_images.image_source_table
         AND species_image.species_id = ranked_images.image_species_id
         AND species_image.image_order = ranked_images.image_order
        LEFT JOIN species_showpic_metadata showpic
          ON ranked_images.image_source = 'showpic'
         AND showpic.source_table = ranked_images.image_source_table
         AND showpic.species_id = ranked_images.image_species_id
         AND showpic.image_order = ranked_images.image_order
        WHERE ranked_images.image_rank = 1
        ORDER BY
          ranked_images.match_rank ASC,
          ranked_images.image_source_rank ASC,
          ranked_images.image_order ASC
      `,
      sourceTable,
      speciesId,
    );

    return rows.map((row) => ({
      imageOrder: Number(row.image_order),
      imageUrl: row.image_source === 'showpic'
        ? `/species/${row.image_source_table}/${row.image_species_id}/showpic-images/${Number(row.image_order)}`
        : `/species/${row.image_source_table}/${row.image_species_id}/images/${Number(row.image_order)}`,
      showpicImageUrl: row.showpic_id && row.showpic_has_image_data
        ? `/species/${row.image_source_table}/${row.image_species_id}/showpic-images/${Number(row.image_order)}`
        : null,
      mimeType: row.mime_type ?? row.showpic_image_mime_type ?? 'image/jpeg',
      width: row.width ?? row.showpic_image_width,
      height: row.height ?? row.showpic_image_height,
      sizeBytes: Number(row.size_bytes ?? row.showpic_image_file_size ?? 0),
      showpicMetadata: row.showpic_id
        ? {
            showpicId: String(row.showpic_id),
            vietnameseName: row.showpic_vietname,
            latinName: row.showpic_latinname,
            author: row.showpic_author,
            sourceImageUrl: row.showpic_source_image_url,
            thumbnailUrl: row.showpic_thumbnail_url,
            imagePath: row.showpic_imagepath,
            imageLocalPath: row.showpic_image_local_path,
            imageMimeType: row.showpic_image_mime_type,
            imageFileSize: row.showpic_image_file_size === null ? null : Number(row.showpic_image_file_size),
            imageWidth: row.showpic_image_width,
            imageHeight: row.showpic_image_height,
            fetchStatus: row.showpic_fetch_status,
            errorMessage: row.showpic_error_message,
            showpicUrl: row.showpic_url,
            fetchedAt: this.serializeDate(row.showpic_fetched_at),
            createdAt: this.serializeDate(row.showpic_created_at),
            updatedAt: this.serializeDate(row.showpic_updated_at),
          }
        : null,
    }));
  }

  private serializeDate(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }

  private resolveSourceLabel(sourceTable: SpeciesSourceTable, taxonomyPath: SpeciesTaxonomyNode[]): string {
    const ranks = new Map(taxonomyPath.map((node) => [node.rank, node.canonicalName.toLowerCase()]));
    const kingdom = ranks.get('kingdom') ?? '';
    const className = ranks.get('class') ?? '';

    if (kingdom === 'plantae') {
      return 'Thực vật';
    }

    if (className === 'insecta') {
      return 'Côn trùng';
    }

    if (kingdom === 'animalia') {
      return 'Động vật';
    }

    return SOURCE_TABLE_LABELS[sourceTable];
  }

  private async findTaxonomyPath(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesTaxonomyNode[]> {
    const rows = await this.prisma.$queryRawUnsafe<TaxonomyPathRow[]>(
      `
        SELECT
          parent.taxon_id,
          parent.rank,
          parent.canonical_name,
          vi.name AS vietnamese_name
        FROM species_taxonomy st
        JOIN taxon_closure tc
          ON tc.descendant_taxon_id = st.taxon_id
        JOIN taxa parent
          ON parent.taxon_id = tc.ancestor_taxon_id
        LEFT JOIN LATERAL (
          SELECT name
          FROM taxon_names
          WHERE taxon_id = parent.taxon_id
            AND language_code = 'vi'
            AND name_type = 'common_name'
          ORDER BY is_preferred DESC, taxon_name_id ASC
          LIMIT 1
        ) vi ON true
        WHERE st.source_table = $1
          AND st.species_id = $2
        ORDER BY tc.depth DESC
      `,
      sourceTable,
      speciesId,
    );

    return rows.map((row) => ({
      taxonId: String(row.taxon_id),
      rank: row.rank,
      canonicalName: row.canonical_name,
      vietnameseName: row.vietnamese_name,
    }));
  }

  private async findKeywordReferences(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesKeywordReference[]> {
    const rows = await this.prisma.$queryRawUnsafe<KeywordReferenceRow[]>(
      `
        SELECT
          sk.keyword_id,
          sk.keyword_text,
          skl.keyword_text_in_detail,
          skl.section_name,
          skl.detail_url,
          sk.keyword_url,
          sk.page_title,
          sk.description_text,
          sk.source_type,
          sk.fetch_status
        FROM species_keyword_links skl
        JOIN site_keywords sk
          ON sk.keyword_id = skl.keyword_id
        WHERE skl.source_table = $1
          AND skl.species_id = $2
        ORDER BY
          skl.section_name ASC NULLS LAST,
          lower(skl.keyword_text_in_detail) ASC,
          sk.keyword_id ASC
      `,
      sourceTable,
      speciesId,
    );

    if (!rows.length) {
      return [];
    }

    const keywordIds = rows.map((row) => String(row.keyword_id));
    const imageRows = await this.prisma.$queryRawUnsafe<KeywordImageRow[]>(
      `
        SELECT keyword_id, image_order, mime_type
        FROM site_keyword_images
        WHERE keyword_id = ANY($1::bigint[])
        ORDER BY keyword_id ASC, image_order ASC
      `,
      keywordIds,
    );
    const imagesByKeyword = new Map<string, KeywordImageRow[]>();

    for (const image of imageRows) {
      const key = String(image.keyword_id);
      imagesByKeyword.set(key, [...(imagesByKeyword.get(key) ?? []), image]);
    }

    return rows.map((row) => {
      const keywordId = String(row.keyword_id);

      return {
        keywordId,
        keywordText: row.keyword_text,
        keywordTextInDetail: row.keyword_text_in_detail,
        sectionName: row.section_name,
        detailUrl: row.detail_url,
        keywordUrl: row.keyword_url,
        pageTitle: row.page_title,
        descriptionText: this.normalizeKeywordDescription(row.description_text),
        sourceType: row.source_type,
        fetchStatus: row.fetch_status,
        images: (imagesByKeyword.get(keywordId) ?? []).map((image) => ({
          imageOrder: Number(image.image_order),
          imageUrl: `/species/keywords/${keywordId}/images/${Number(image.image_order)}`,
          mimeType: image.mime_type ?? 'image/jpeg',
        })),
      };
    });
  }

  private async findConservationSummary(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesConservationSummary> {
    const [termRows, profileRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<ConservationTermRow[]>(
        `
          SELECT
            term.term_id,
            term.term_text,
            term.term_type,
            term.category_code,
            term.criteria_code,
            term.severity_order,
            link.source_field,
            link.matched_text,
            link.context
          FROM species_conservation_terms link
          JOIN conservation_terms term
            ON term.term_id = link.term_id
          WHERE link.source_table = $1
            AND link.species_id = $2
          ORDER BY
            term.severity_order ASC NULLS LAST,
            term.term_type ASC,
            term.term_text ASC
        `,
        sourceTable,
        speciesId,
      ),
      this.prisma.$queryRawUnsafe<VnRedListProfileRow[]>(
        `
          SELECT
            profile.profile_id,
            profile.page_url,
            profile.scientific_name,
            profile.vietnamese_name,
            profile.page_title,
            profile.redlist_category,
            profile.redlist_criteria,
            profile.published_year,
            profile.assessor,
            profile.contributors,
            profile.distribution_vietnam,
            profile.distribution_world,
            profile.habitat,
            profile.threats,
            profile.conservation_status,
            profile.conservation_measures_existing,
            profile.conservation_measures_proposed,
            profile.representative_image_url,
            match.match_method,
            match.confidence
          FROM species_vnredlist_matches match
          JOIN vnredlist_profiles profile
            ON profile.profile_id = match.profile_id
          WHERE match.source_table = $1
            AND match.species_id = $2
          ORDER BY
            match.confidence DESC,
            profile.profile_id ASC
          LIMIT 1
        `,
        sourceTable,
        speciesId,
      ),
    ]);

    const terms = termRows.map((row) => ({
      termId: String(row.term_id),
      termText: row.term_text,
      termType: row.term_type,
      categoryCode: row.category_code,
      criteriaCode: row.criteria_code,
      severityOrder: row.severity_order,
      sourceField: row.source_field,
      matchedText: row.matched_text,
      context: row.context,
    }));
    const profile = profileRows[0] ?? null;
    const highestRiskCategory =
      profile?.redlist_category?.trim() ||
      terms.find((term) => term.termType === 'redlist_category')?.categoryCode ||
      null;

    return {
      vnRedListProfile: profile
        ? {
            profileId: String(profile.profile_id),
            pageUrl: profile.page_url,
            scientificName: profile.scientific_name,
            vietnameseName: profile.vietnamese_name,
            pageTitle: profile.page_title,
            redlistCategory: profile.redlist_category,
            redlistCriteria: profile.redlist_criteria,
            publishedYear: profile.published_year,
            assessor: profile.assessor,
            contributors: profile.contributors,
            distributionVietnam: profile.distribution_vietnam,
            distributionWorld: profile.distribution_world,
            habitat: profile.habitat,
            threats: profile.threats,
            conservationStatus: profile.conservation_status,
            conservationMeasuresExisting: profile.conservation_measures_existing,
            conservationMeasuresProposed: profile.conservation_measures_proposed,
            representativeImageUrl: profile.representative_image_url,
            matchMethod: profile.match_method,
            confidence: profile.confidence,
          }
        : null,
      terms,
      highestRiskCategory,
      isSensitiveOccurrence: this.isSensitiveRedListCategory(highestRiskCategory),
    };
  }

  private isSensitiveRedListCategory(category: string | null): boolean {
    return category?.trim().toUpperCase() === 'EN';
  }

  private normalizeKeywordDescription(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    return value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]*\n+[ \t]*/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  private normalizeDetailValue(key: string, value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    if (key === 'title_block') {
      return text;
    }

    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]*\n+[ \t]*/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }
}
