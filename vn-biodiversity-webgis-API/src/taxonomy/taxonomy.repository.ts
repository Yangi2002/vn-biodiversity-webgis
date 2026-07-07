import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  TaxonomyFacetItem,
  TaxonomySearchItem,
} from './types/taxonomy-search-result.type';

interface CountRow {
  total: bigint | number;
}

interface TaxonomyRow {
  taxon_id: bigint | number;
  parent_taxon_id: bigint | number | null;
  rank: string;
  canonical_name: string;
  vietnamese_name: string | null;
  path_names: string[] | null;
  species_count: bigint | number;
  child_count: bigint | number;
  image_source_table: string | null;
  image_species_id: string | null;
  image_vietnamese_name: string | null;
  image_scientific_name: string | null;
  image_order: number | null;
  image_mime_type: string | null;
  image_width: number | null;
  image_height: number | null;
  image_size_bytes: bigint | number | null;
  showpic_id: bigint | number | null;
  showpic_vietname: string | null;
  showpic_latinname: string | null;
  showpic_author: string | null;
  showpic_source_image_url: string | null;
  showpic_thumbnail_url: string | null;
  showpic_image_mime_type: string | null;
  showpic_image_file_size: bigint | number | null;
  showpic_image_width: number | null;
  showpic_image_height: number | null;
  showpic_fetch_status: string | null;
  showpic_error_message: string | null;
  showpic_url: string | null;
}

interface RankFacetRow {
  rank: string;
  total: bigint | number;
}

interface FilterSql {
  whereSql: string;
  values: unknown[];
}

const RANK_LABELS: Record<string, string> = {
  root: 'Root',
  source_group: 'Nhóm nguồn',
  kingdom: 'Giới',
  phylum: 'Ngành',
  class: 'Lớp',
  order: 'Bộ',
  family: 'Họ',
  genus: 'Chi',
  species: 'Loài',
};

const SPECIES_UNION_SQL = `
  SELECT
    'animal_db_vn'::text AS source_table,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name
  FROM animal_db_vn
  UNION ALL
  SELECT
    'plant_db_vn'::text AS source_table,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name
  FROM plant_db_vn
  UNION ALL
  SELECT
    'insect_db_vn'::text AS source_table,
    species_id,
    ten_viet_nam AS vietnamese_name,
    ten_latin AS scientific_name
  FROM insect_db_vn
`;

@Injectable()
export class TaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, rank: string, limit: number, offset: number): Promise<TaxonomySearchItem[]> {
    const filterSql = this.buildFilterSql(query, rank);
    const rows = await this.prisma.$queryRawUnsafe<TaxonomyRow[]>(
      `
        WITH filtered_taxa AS (
          SELECT t.*
          FROM taxa t
          WHERE ${filterSql.whereSql}
        ),
        species_union AS (${SPECIES_UNION_SQL})
        SELECT
          t.taxon_id,
          t.parent_taxon_id,
          t.rank,
          t.canonical_name,
          vi.name AS vietnamese_name,
          taxonomy_path.path_names,
          coalesce(species_stats.species_count, 0) AS species_count,
          coalesce(child_stats.child_count, 0) AS child_count,
          representative_image.source_table AS image_source_table,
          representative_image.species_id AS image_species_id,
          representative_image.vietnamese_name AS image_vietnamese_name,
          representative_image.scientific_name AS image_scientific_name,
          representative_image.image_order,
          representative_image.mime_type AS image_mime_type,
          representative_image.width AS image_width,
          representative_image.height AS image_height,
          representative_image.size_bytes AS image_size_bytes,
          representative_image.showpic_id,
          representative_image.showpic_vietname,
          representative_image.showpic_latinname,
          representative_image.showpic_author,
          representative_image.showpic_source_image_url,
          representative_image.showpic_thumbnail_url,
          representative_image.showpic_image_mime_type,
          representative_image.showpic_image_file_size,
          representative_image.showpic_image_width,
          representative_image.showpic_image_height,
          representative_image.showpic_fetch_status,
          representative_image.showpic_error_message,
          representative_image.showpic_url
        FROM filtered_taxa t
        LEFT JOIN LATERAL (
          SELECT name
          FROM taxon_names
          WHERE taxon_id = t.taxon_id
            AND language_code = 'vi'
            AND name_type = 'common_name'
          ORDER BY is_preferred DESC, taxon_name_id ASC
          LIMIT 1
        ) vi ON true
        LEFT JOIN LATERAL (
          SELECT array_agg(parent.canonical_name ORDER BY tc.depth DESC) AS path_names
          FROM taxon_closure tc
          JOIN taxa parent
            ON parent.taxon_id = tc.ancestor_taxon_id
          WHERE tc.descendant_taxon_id = t.taxon_id
        ) taxonomy_path ON true
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT st.source_table || ':' || st.species_id) AS species_count
          FROM taxon_closure tc
          JOIN taxa species_taxon
            ON species_taxon.taxon_id = tc.descendant_taxon_id
           AND species_taxon.rank = 'species'
          JOIN species_taxonomy st
            ON st.taxon_id = species_taxon.taxon_id
          WHERE tc.ancestor_taxon_id = t.taxon_id
        ) species_stats ON true
        LEFT JOIN LATERAL (
          SELECT count(*) AS child_count
          FROM taxa child
          WHERE child.parent_taxon_id = t.taxon_id
        ) child_stats ON true
        LEFT JOIN LATERAL (
          SELECT
            st.source_table,
            st.species_id,
            species_union.vietnamese_name,
            species_union.scientific_name,
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
            showpic.image_mime_type AS showpic_image_mime_type,
            showpic.image_file_size AS showpic_image_file_size,
            showpic.image_width AS showpic_image_width,
            showpic.image_height AS showpic_image_height,
            showpic.fetch_status AS showpic_fetch_status,
            showpic.error_message AS showpic_error_message,
            showpic.showpic_url
          FROM taxon_closure tc
          JOIN taxa species_taxon
            ON species_taxon.taxon_id = tc.descendant_taxon_id
           AND species_taxon.rank = 'species'
          JOIN species_taxonomy st
            ON st.taxon_id = species_taxon.taxon_id
          JOIN species_union
            ON species_union.source_table = st.source_table
           AND species_union.species_id = st.species_id
          JOIN species_images species_image
            ON species_image.source_table = st.source_table
           AND species_image.species_id = st.species_id
          LEFT JOIN species_showpic_metadata showpic
            ON showpic.source_table = species_image.source_table
           AND showpic.species_id = species_image.species_id
           AND showpic.image_order = species_image.image_order
          WHERE tc.ancestor_taxon_id = t.taxon_id
          ORDER BY
            (coalesce(showpic.image_width, species_image.width, 0) * coalesce(showpic.image_height, species_image.height, 0)) DESC,
            octet_length(species_image.image_data) DESC,
            species_image.image_order ASC
          LIMIT 1
        ) representative_image ON true
        ORDER BY
          CASE t.rank
            WHEN 'kingdom' THEN 1
            WHEN 'phylum' THEN 2
            WHEN 'class' THEN 3
            WHEN 'order' THEN 4
            WHEN 'family' THEN 5
            WHEN 'genus' THEN 6
            WHEN 'species' THEN 7
            ELSE 8
          END,
          t.canonical_name ASC
        LIMIT $${filterSql.values.length + 1} OFFSET $${filterSql.values.length + 2}
      `,
      ...filterSql.values,
      limit,
      offset,
    );

    return rows.map((row) => ({
      taxonId: String(row.taxon_id),
      parentTaxonId: row.parent_taxon_id === null ? null : String(row.parent_taxon_id),
      rank: row.rank,
      rankLabel: RANK_LABELS[row.rank] ?? row.rank,
      canonicalName: row.canonical_name,
      vietnameseName: row.vietnamese_name,
      taxonomicStatus: 'accepted',
      path: row.path_names ?? [row.canonical_name],
      speciesCount: Number(row.species_count),
      childCount: Number(row.child_count),
      representativeImage:
        row.image_source_table && row.image_species_id && row.image_order
          ? {
              sourceTable: row.image_source_table,
              speciesId: row.image_species_id,
              vietnameseName: row.image_vietnamese_name,
              scientificName: row.image_scientific_name,
              imageOrder: Number(row.image_order),
              imageUrl: `/species/${row.image_source_table}/${row.image_species_id}/images/${Number(row.image_order)}`,
              mimeType: row.image_mime_type ?? 'image/jpeg',
              width: row.image_width,
              height: row.image_height,
              sizeBytes: Number(row.image_size_bytes ?? 0),
              metadata: row.showpic_id
                ? {
                    showpicId: String(row.showpic_id),
                    vietnameseName: row.showpic_vietname,
                    latinName: row.showpic_latinname,
                    author: row.showpic_author,
                    sourceImageUrl: row.showpic_source_image_url,
                    thumbnailUrl: row.showpic_thumbnail_url,
                    imageMimeType: row.showpic_image_mime_type,
                    imageFileSize: row.showpic_image_file_size === null ? null : Number(row.showpic_image_file_size),
                    imageWidth: row.showpic_image_width,
                    imageHeight: row.showpic_image_height,
                    fetchStatus: row.showpic_fetch_status,
                    errorMessage: row.showpic_error_message,
                    showpicUrl: row.showpic_url,
                  }
                : null,
            }
          : null,
    }));
  }

  async count(query: string, rank: string): Promise<number> {
    const filterSql = this.buildFilterSql(query, rank);
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        SELECT count(*) AS total
        FROM taxa t
        WHERE ${filterSql.whereSql}
      `,
      ...filterSql.values,
    );

    return Number(rows[0]?.total ?? 0);
  }

  async rankFacets(query: string): Promise<TaxonomyFacetItem[]> {
    const filterSql = this.buildFilterSql(query, '');
    const rows = await this.prisma.$queryRawUnsafe<RankFacetRow[]>(
      `
        SELECT t.rank, count(*) AS total
        FROM taxa t
        WHERE ${filterSql.whereSql}
        GROUP BY t.rank
        ORDER BY total DESC, t.rank ASC
      `,
      ...filterSql.values,
    );

    return rows.map((row) => ({
      value: row.rank,
      label: RANK_LABELS[row.rank] ?? row.rank,
      count: Number(row.total),
    }));
  }

  private buildFilterSql(query: string, rank: string): FilterSql {
    const clauses: string[] = ['true'];
    const values: unknown[] = [];

    if (query) {
      values.push(query);
      const index = values.length;
      clauses.push(`
        (
          lower(t.canonical_name) LIKE lower('%' || $${index} || '%')
          OR lower(t.normalized_name) LIKE lower('%' || $${index} || '%')
          OR EXISTS (
            SELECT 1
            FROM taxon_names tn
            WHERE tn.taxon_id = t.taxon_id
              AND (
                lower(tn.name) LIKE lower('%' || $${index} || '%')
                OR lower(tn.normalized_name) LIKE lower('%' || $${index} || '%')
              )
          )
        )
      `);
    }

    if (rank) {
      values.push(rank);
      clauses.push(`t.rank = $${values.length}`);
    }

    return {
      whereSql: clauses.join('\n          AND '),
      values,
    };
  }
}
