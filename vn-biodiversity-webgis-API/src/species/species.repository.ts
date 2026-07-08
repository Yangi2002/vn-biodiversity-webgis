import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: bigint | number;
  showpic_id: bigint | number | null;
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

interface FacetRow {
  value: string | null;
  label: string | null;
  total: bigint | number;
}

type SpeciesDetailRow = Record<string, string | null>;

const SOURCE_TABLE_LABELS: Record<SpeciesSourceTable, string> = {
  animal_db_vn: 'Động vật',
  plant_db_vn: 'Thực vật',
  insect_db_vn: 'Côn trùng',
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
};

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
    title_block
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
    title_block
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
    title_block
  FROM insect_db_vn
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
  )
`;

interface FilterSql {
  whereSql: string;
  values: unknown[];
}

@Injectable()
export class SpeciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: string,
    filters: SpeciesSearchFilters,
    limit: number,
    offset: number,
  ): Promise<SpeciesSearchResult[]> {
    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<SpeciesSearchRow[]>(
      `
        WITH species_union AS (${SPECIES_UNION_SQL})
        SELECT
          species_union.*,
          CASE
            WHEN species_image.image_id IS NULL THEN NULL
            ELSE '/species/' || species_union.source_table || '/' || species_union.species_id || '/image'
          END AS image_url,
          species_image.mime_type AS image_mime_type
        FROM species_union
        LEFT JOIN LATERAL (
          SELECT image_id, local_path, mime_type, width, height
          FROM species_images
          WHERE source_table = species_union.source_table
            AND species_id = species_union.species_id
          ORDER BY
            (coalesce(width, 0) * coalesce(height, 0)) DESC,
            octet_length(image_data) DESC,
            image_order ASC
          LIMIT 1
        ) species_image ON true
        WHERE ${SEARCH_FILTER_SQL}
          ${filterSql.whereSql}
        ORDER BY
          CASE WHEN vietnamese_name IS NULL OR vietnamese_name = '' THEN 1 ELSE 0 END,
          vietnamese_name ASC NULLS LAST,
          scientific_name ASC NULLS LAST
        LIMIT $${filterSql.values.length + 2} OFFSET $${filterSql.values.length + 3}
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
    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        WITH species_union AS (${SPECIES_UNION_SQL})
        SELECT count(*) AS total
        FROM species_union
        WHERE ${SEARCH_FILTER_SQL}
          ${filterSql.whereSql}
      `,
      query,
      ...filterSql.values,
    );

    return Number(rows[0]?.total ?? 0);
  }

  async facets(query: string, filters: SpeciesSearchFilters): Promise<SpeciesSearchFacets> {
    const [sourceTables, classNames, orders, families, genera] = await Promise.all([
      this.facet(query, filters, 'source_table', 'source_label'),
      this.facet(query, filters, 'class_name'),
      this.facet(query, filters, 'order_name'),
      this.facet(query, filters, 'family'),
      this.facet(query, filters, 'genus_name'),
    ]);

    return { sourceTables, classNames, orders, families, genera };
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
            WHEN species_image.image_id IS NULL THEN NULL
            ELSE '/species/' || $1 || '/' || species.species_id || '/image'
          END AS image_url,
          species_image.mime_type AS image_mime_type
        FROM ${sourceTable} species
        LEFT JOIN LATERAL (
          SELECT image_id, local_path, mime_type, width, height
          FROM species_images
          WHERE source_table = $1
            AND species_id = species.species_id
          ORDER BY
            (coalesce(width, 0) * coalesce(height, 0)) DESC,
            octet_length(image_data) DESC,
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

    const [images, taxonomyPath, keywords] = await Promise.all([
      this.findImageList(sourceTable, speciesId),
      this.findTaxonomyPath(sourceTable, speciesId),
      this.findKeywordReferences(sourceTable, speciesId),
    ]);

    return {
      sourceTable,
      sourceLabel: SOURCE_TABLE_LABELS[sourceTable],
      speciesId: row.species_id ?? speciesId,
      vietnameseName: row.ten_viet_nam,
      scientificName: row.ten_latin,
      family: row.ho,
      order: row.bo,
      className: row.lop_nhom,
      titleBlock: row.title_block,
      imageUrl: row.image_url,
      imageMimeType: row.image_mime_type,
      images,
      taxonomyPath,
      keywords,
      fields: this.mapDetailFields(row),
    };
  }

  async findPrimaryImage(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesImageResult | null> {
    const rows = await this.prisma.$queryRawUnsafe<ImageRow[]>(
      `
        SELECT image_data, mime_type
        FROM species_images
        WHERE source_table = $1
          AND species_id = $2
        ORDER BY
          (coalesce(width, 0) * coalesce(height, 0)) DESC,
          octet_length(image_data) DESC,
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

  private async facet(
    query: string,
    filters: SpeciesSearchFilters,
    column: 'source_table' | 'class_name' | 'order_name' | 'family' | 'genus_name',
    labelColumn: 'source_label' | 'source_table' | 'class_name' | 'order_name' | 'family' | 'genus_name' = column,
  ): Promise<SpeciesFacetItem[]> {
    const filterSql = this.buildFilterSql(filters, 2);
    const rows = await this.prisma.$queryRawUnsafe<FacetRow[]>(
      `
        WITH species_union AS (${SPECIES_UNION_SQL})
        SELECT
          ${column} AS value,
          min(${labelColumn}) AS label,
          count(*) AS total
        FROM species_union
        WHERE ${SEARCH_FILTER_SQL}
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

    return rows.map((row) => ({
      value: row.value ?? '',
      label: row.label ?? row.value ?? '',
      count: Number(row.total),
    }));
  }

  private buildFilterSql(filters: SpeciesSearchFilters, startIndex: number): FilterSql {
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

    if (filters.taxonId) {
      values.push(filters.taxonId);
      clauses.push(`
        AND EXISTS (
          SELECT 1
          FROM species_taxonomy st
          JOIN taxon_closure tc
            ON tc.descendant_taxon_id = st.taxon_id
          WHERE st.source_table = species_union.source_table
            AND st.species_id = species_union.species_id
            AND tc.ancestor_taxon_id = $${startIndex + values.length - 1}::bigint
        )
      `);
    }

    return {
      whereSql: clauses.length ? `\n          ${clauses.join('\n          ')}` : '',
      values,
    };
  }

  private mapDetailFields(row: SpeciesDetailRow): SpeciesDetailField[] {
    return Object.entries(row)
      .filter(([key]) => !['detail_url', 'hinh', 'image_url', 'image_mime_type'].includes(key))
      .map(([key, value]) => ({
        key,
        label: DETAIL_FIELD_LABELS[key] ?? key,
        value: this.normalizeDetailValue(key, value),
      }));
  }

  private async findImageList(
    sourceTable: SpeciesSourceTable,
    speciesId: string,
  ): Promise<SpeciesDetailImage[]> {
    const rows = await this.prisma.$queryRawUnsafe<SpeciesImageRow[]>(
      `
        SELECT
          species_image.image_order,
          species_image.mime_type,
          species_image.width,
          species_image.height,
          octet_length(species_image.image_data) AS size_bytes,
          showpic.showpic_id,
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
        FROM species_images species_image
        LEFT JOIN species_showpic_metadata showpic
          ON showpic.source_table = species_image.source_table
         AND showpic.species_id = species_image.species_id
         AND showpic.image_order = species_image.image_order
        WHERE species_image.source_table = $1
          AND species_image.species_id = $2
        ORDER BY
          (coalesce(species_image.width, 0) * coalesce(species_image.height, 0)) DESC,
          octet_length(species_image.image_data) DESC,
          species_image.image_order ASC
      `,
      sourceTable,
      speciesId,
    );

    return rows.map((row) => ({
      imageOrder: Number(row.image_order),
      imageUrl: `/species/${sourceTable}/${speciesId}/images/${Number(row.image_order)}`,
      mimeType: row.mime_type ?? 'image/jpeg',
      width: row.width,
      height: row.height,
      sizeBytes: Number(row.size_bytes),
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
