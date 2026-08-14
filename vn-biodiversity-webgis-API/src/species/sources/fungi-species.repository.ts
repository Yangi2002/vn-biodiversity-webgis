import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { SpeciesSourceTable } from '../types/species-source.type';
import type {
  SpeciesSearchFacets,
  SpeciesSearchFilters,
  SpeciesSearchResult,
} from '../types/species-search-result.type';

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

interface FacetUnionRow {
  facet_name: 'sourceTables' | 'kingdoms' | 'classNames' | 'orders' | 'families' | 'genera';
  value: string | null;
  label: string | null;
  total: bigint | number;
}

@Injectable()
export class FungiSpeciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  canHandleFastList(filters: SpeciesSearchFilters): boolean {
    const sourceTableMatches = !filters.sourceTable || filters.sourceTable === 'fungi_db_vn';
    const kingdomMatches = !filters.kingdom || filters.kingdom.trim().toLowerCase() === 'fungi';

    return sourceTableMatches && kingdomMatches && (filters.sourceTable === 'fungi_db_vn' || filters.kingdom.trim().toLowerCase() === 'fungi') && !filters.taxonId;
  }

  async search(
    query: string,
    filters: SpeciesSearchFilters,
    limit: number,
    offset: number,
  ): Promise<SpeciesSearchResult[]> {
    const rows = await this.prisma.$queryRawUnsafe<SpeciesSearchRow[]>(
      `
        WITH filtered_species AS (
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
        ),
        paged_species AS (
          SELECT *
          FROM filtered_species
          WHERE ${this.filterSql()}
          ORDER BY
            CASE WHEN vietnamese_name IS NULL OR vietnamese_name = '' THEN 1 ELSE 0 END,
            vietnamese_name ASC NULLS LAST,
            scientific_name ASC NULLS LAST
          LIMIT $6 OFFSET $7
        ),
        image_candidates AS (
          SELECT
            paged_species.species_id AS owner_species_id,
            species_image.image_order,
            'species'::text AS image_source,
            species_image.source_table AS image_source_table,
            species_image.species_id AS image_species_id,
            2 AS image_source_rank,
            0 AS match_rank,
            species_image.mime_type
          FROM paged_species
          JOIN species_images species_image
            ON species_image.source_table = paged_species.source_table
           AND species_image.species_id = paged_species.species_id
          UNION ALL
          SELECT
            paged_species.species_id AS owner_species_id,
            showpic.image_order,
            'showpic'::text AS image_source,
            showpic.source_table AS image_source_table,
            showpic.species_id AS image_species_id,
            CASE WHEN showpic.source_payload ->> 'source_type' = 'wordpress_species_gallery' THEN 0 ELSE 1 END AS image_source_rank,
            0 AS match_rank,
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
              PARTITION BY owner_species_id
              ORDER BY match_rank ASC, image_source_rank ASC, image_order ASC
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
          ON species_image.owner_species_id = species.species_id
         AND species_image.image_rank = 1
        ORDER BY
          CASE WHEN species.vietnamese_name IS NULL OR species.vietnamese_name = '' THEN 1 ELSE 0 END,
          species.vietnamese_name ASC NULLS LAST,
          species.scientific_name ASC NULLS LAST
      `,
      query,
      filters.className,
      filters.order,
      filters.family,
      filters.genus,
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
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        WITH fungi_rows AS (
          SELECT
            species_id,
            ten_viet_nam AS vietnamese_name,
            ten_latin AS scientific_name,
            ho AS family,
            bo AS order_name,
            lop_nhom AS class_name,
            nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
            concat_ws(' ', title_block, dong_danh, ten_khac, ten_tieng_anh) AS search_text
          FROM fungi_db_vn
        ),
        filtered_species AS (
          SELECT *
          FROM fungi_rows
          WHERE ${this.filterSql()}
        )
        SELECT count(*) AS total
        FROM filtered_species
      `,
      query,
      filters.className,
      filters.order,
      filters.family,
      filters.genus,
    );

    return Number(rows[0]?.total ?? 0);
  }

  async facets(query: string, filters: SpeciesSearchFilters): Promise<SpeciesSearchFacets> {
    const rows = await this.prisma.$queryRawUnsafe<FacetUnionRow[]>(
      `
        WITH fungi_rows AS (
          SELECT
            species_id,
            ten_viet_nam AS vietnamese_name,
            ten_latin AS scientific_name,
            ho AS family,
            bo AS order_name,
            lop_nhom AS class_name,
            nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
            concat_ws(' ', title_block, dong_danh, ten_khac, ten_tieng_anh) AS search_text
          FROM fungi_db_vn
        ),
        filtered_species AS (
          SELECT *
          FROM fungi_rows
          WHERE ${this.filterSql()}
        ),
        facet_source_tables AS (
          SELECT 'sourceTables'::text AS facet_name, 'fungi_db_vn'::text AS value, 'Nấm'::text AS label, count(*) AS total
          FROM filtered_species
        ),
        facet_kingdoms AS (
          SELECT 'kingdoms'::text AS facet_name, 'Fungi'::text AS value, 'Fungi'::text AS label, count(*) AS total
          FROM filtered_species
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
        SELECT * FROM facet_source_tables WHERE total > 0
        UNION ALL SELECT * FROM facet_kingdoms WHERE total > 0
        UNION ALL SELECT * FROM facet_class_names
        UNION ALL SELECT * FROM facet_orders
        UNION ALL SELECT * FROM facet_families
        UNION ALL SELECT * FROM facet_genera
      `,
      query,
      filters.className,
      filters.order,
      filters.family,
      filters.genus,
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

  private filterSql(): string {
    return `
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
      AND ($2 = '' OR class_name = $2)
      AND ($3 = '' OR order_name = $3)
      AND ($4 = '' OR family = $4)
      AND ($5 = '' OR genus_name = $5)
    `;
  }

  private kingdomFacetLabel(value: string): string {
    return value.trim().toLowerCase() === 'fungi' ? 'Nấm - Fungi' : value;
  }
}
