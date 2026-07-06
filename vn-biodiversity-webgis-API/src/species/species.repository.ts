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
  detail_url: string | null;
  image_url: string | null;
  image_source: string | null;
  image_mime_type: string | null;
}

interface CountRow {
  total: bigint | number;
}

interface ImageRow {
  image_data: Uint8Array;
  mime_type: string | null;
}

interface FacetRow {
  value: string | null;
  label: string | null;
  total: bigint | number;
}

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
    detail_url,
    hinh AS image_source
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
    detail_url,
    hinh AS image_source
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
    detail_url,
    hinh AS image_source
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
          coalesce(species_union.image_source, species_image.local_path) AS image_source,
          species_image.mime_type AS image_mime_type
        FROM species_union
        LEFT JOIN LATERAL (
          SELECT image_id, local_path, mime_type
          FROM species_images
          WHERE source_table = species_union.source_table
            AND species_id = species_union.species_id
          ORDER BY image_order ASC
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
      detailUrl: row.detail_url,
      imageUrl: row.image_url,
      imageSource: row.image_source,
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
        ORDER BY image_order ASC
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

    return {
      whereSql: clauses.length ? `\n          ${clauses.join('\n          ')}` : '',
      values,
    };
  }
}
