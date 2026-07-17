import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SpeciesSourceTable } from '../species/types/species-source.type';
import type {
  ConservationCategorySummary,
  ConservationCategoryOption,
  ConservationSpeciesItem,
  ConservationSourceGroupSummary,
  ObservationTermOption,
} from './types/conservation.type';

interface CountRow {
  total: bigint | number;
}

interface ConservationSpeciesRow {
  source_table: SpeciesSourceTable;
  source_label: string;
  species_id: string;
  vietnamese_name: string | null;
  scientific_name: string | null;
  family: string | null;
  order_name: string | null;
  class_name: string | null;
  image_url: string | null;
  profile_id: bigint | number;
  page_url: string;
  redlist_category: string | null;
  redlist_criteria: string | null;
  published_year: string | null;
  assessor: string | null;
  contributors: string | null;
  distribution_vietnam: string | null;
  habitat: string | null;
  threats: string | null;
  conservation_status: string | null;
  representative_image_url: string | null;
  match_method: string;
  confidence: number;
}

interface CategoryRow {
  category: string | null;
  label: string | null;
  total: bigint | number;
}

interface CategoryOptionRow {
  category: string;
  label: string | null;
  severity_order: number | null;
}

interface SourceGroupRow {
  source_table: SpeciesSourceTable;
  source_label: string;
  total: bigint | number;
}

interface ObservationTermRow {
  term_id: bigint | number;
  label: string;
  term_type: string | null;
  total: bigint | number;
}

interface ConservationFilter {
  query: string;
  category: string;
  sourceTable: string;
  observationTermId: string;
}

const SOURCE_LABEL_SQL = `
  CASE match.source_table
    WHEN 'animal_db_vn' THEN 'Động vật'
    WHEN 'plant_db_vn' THEN 'Thực vật'
    WHEN 'insect_db_vn' THEN 'Côn trùng'
    ELSE match.source_table
  END
`;

@Injectable()
export class ConservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSpecies(filter: ConservationFilter, limit: number, offset: number): Promise<ConservationSpeciesItem[]> {
    const filterSql = await this.buildFilterSql(filter, 1);
    const rows = await this.prisma.$queryRawUnsafe<ConservationSpeciesRow[]>(
      `
        SELECT
          match.source_table,
          ${SOURCE_LABEL_SQL} AS source_label,
          match.species_id,
          coalesce(animal.ten_viet_nam, plant.ten_viet_nam, insect.ten_viet_nam, profile.vietnamese_name) AS vietnamese_name,
          coalesce(animal.ten_latin, plant.ten_latin, insect.ten_latin, profile.scientific_name) AS scientific_name,
          coalesce(animal.ho, plant.ho, insect.ho, profile.family) AS family,
          coalesce(animal.bo, plant.bo, insect.bo, profile.order_name) AS order_name,
          coalesce(animal.lop_nhom, plant.lop_nhom, insect.lop_nhom, profile.class_name) AS class_name,
          CASE
            WHEN species_image.image_id IS NULL THEN NULL
            ELSE '/species/' || match.source_table || '/' || match.species_id || '/image'
          END AS image_url,
          profile.profile_id,
          profile.page_url,
          profile.redlist_category,
          profile.redlist_criteria,
          profile.published_year,
          profile.assessor,
          profile.contributors,
          profile.distribution_vietnam,
          profile.habitat,
          profile.threats,
          profile.conservation_status,
          profile.representative_image_url,
          match.match_method,
          match.confidence
        FROM species_vnredlist_matches match
        JOIN vnredlist_profiles profile
          ON profile.profile_id = match.profile_id
        LEFT JOIN animal_db_vn animal
          ON animal.species_id = match.animal_species_id
        LEFT JOIN plant_db_vn plant
          ON plant.species_id = match.plant_species_id
        LEFT JOIN insect_db_vn insect
          ON insect.species_id = match.insect_species_id
        LEFT JOIN LATERAL (
          SELECT image_id
          FROM species_images
          WHERE source_table = match.source_table
            AND species_id = match.species_id
          ORDER BY
            (coalesce(width, 0) * coalesce(height, 0)) DESC,
            octet_length(image_data) DESC,
            image_order ASC
          LIMIT 1
        ) species_image ON true
        JOIN conservation_terms category_term
          ON category_term.term_type = 'vnredlist_red_list_category'
         AND category_term.category_code = profile.redlist_category
        WHERE ${filterSql.whereSql}
        ORDER BY
          category_term.severity_order DESC NULLS LAST,
          match.confidence DESC,
          vietnamese_name ASC NULLS LAST,
          scientific_name ASC NULLS LAST
        LIMIT $${filterSql.values.length + 1}
        OFFSET $${filterSql.values.length + 2}
      `,
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
      imageUrl: row.image_url,
      profileId: String(row.profile_id),
      pageUrl: row.page_url,
      redlistCategory: row.redlist_category,
      redlistCriteria: row.redlist_criteria,
      publishedYear: row.published_year,
      assessor: row.assessor,
      contributors: row.contributors,
      distributionVietnam: row.distribution_vietnam,
      habitat: row.habitat,
      threats: row.threats,
      conservationStatus: row.conservation_status,
      representativeImageUrl: row.representative_image_url,
      matchMethod: row.match_method,
      confidence: row.confidence,
    }));
  }

  async countSpecies(filter: ConservationFilter): Promise<number> {
    const filterSql = await this.buildFilterSql(filter, 1);
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `
        SELECT count(*) AS total
        FROM species_vnredlist_matches match
        JOIN vnredlist_profiles profile
          ON profile.profile_id = match.profile_id
        LEFT JOIN animal_db_vn animal
          ON animal.species_id = match.animal_species_id
        LEFT JOIN plant_db_vn plant
          ON plant.species_id = match.plant_species_id
        LEFT JOIN insect_db_vn insect
          ON insect.species_id = match.insect_species_id
        WHERE ${filterSql.whereSql}
      `,
      ...filterSql.values,
    );

    return Number(rows[0]?.total ?? 0);
  }

  async countProfiles(): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT count(*) AS total
      FROM vnredlist_profiles
      WHERE fetch_status IN ('ok', 'success')
    `;

    return Number(rows[0]?.total ?? 0);
  }

  async categorySummary(filter: ConservationFilter): Promise<ConservationCategorySummary[]> {
    const filterSql = await this.buildFilterSql({ ...filter, category: '' }, 1);
    const rows = await this.prisma.$queryRawUnsafe<CategoryRow[]>(
      `
        SELECT
          profile.redlist_category AS category,
          min(category_term.description) AS label,
          count(*) AS total
        FROM species_vnredlist_matches match
        JOIN vnredlist_profiles profile
          ON profile.profile_id = match.profile_id
        JOIN conservation_terms category_term
          ON category_term.term_type = 'vnredlist_red_list_category'
         AND category_term.category_code = profile.redlist_category
        LEFT JOIN animal_db_vn animal
          ON animal.species_id = match.animal_species_id
        LEFT JOIN plant_db_vn plant
          ON plant.species_id = match.plant_species_id
        LEFT JOIN insect_db_vn insect
          ON insect.species_id = match.insect_species_id
        WHERE ${filterSql.whereSql}
        GROUP BY profile.redlist_category, category_term.severity_order
        ORDER BY category_term.severity_order DESC NULLS LAST
      `,
      ...filterSql.values,
    );

    return rows.map((row) => ({
      category: row.category ?? 'Chưa rõ',
      total: Number(row.total),
    }));
  }

  async categoryOptions(): Promise<ConservationCategoryOption[]> {
    const rows = await this.prisma.$queryRaw<CategoryOptionRow[]>`
      SELECT
        category_code AS category,
        description AS label,
        severity_order
      FROM conservation_terms
      WHERE term_type = 'vnredlist_red_list_category'
        AND category_code IS NOT NULL
        AND category_code <> ''
      ORDER BY severity_order DESC NULLS LAST, category_code ASC
    `;

    return rows.map((row) => ({
      category: row.category,
      label: row.label ?? row.category,
      severityOrder: row.severity_order,
    }));
  }

  async sourceGroupSummary(filter: ConservationFilter): Promise<ConservationSourceGroupSummary[]> {
    const filterSql = await this.buildFilterSql({ ...filter, sourceTable: '' }, 1);
    const rows = await this.prisma.$queryRawUnsafe<SourceGroupRow[]>(
      `
        SELECT match.source_table, ${SOURCE_LABEL_SQL} AS source_label, count(*) AS total
        FROM species_vnredlist_matches match
        JOIN vnredlist_profiles profile
          ON profile.profile_id = match.profile_id
        LEFT JOIN animal_db_vn animal
          ON animal.species_id = match.animal_species_id
        LEFT JOIN plant_db_vn plant
          ON plant.species_id = match.plant_species_id
        LEFT JOIN insect_db_vn insect
          ON insect.species_id = match.insect_species_id
        WHERE ${filterSql.whereSql}
        GROUP BY match.source_table
        ORDER BY total DESC
      `,
      ...filterSql.values,
    );

    return rows.map((row) => ({
      sourceTable: row.source_table,
      sourceLabel: row.source_label,
      total: Number(row.total),
    }));
  }

  async observationTerms(): Promise<ObservationTermOption[]> {
    const hasTables = await this.hasObservationTermTables();

    if (!hasTables) {
      return [];
    }

    const rows = await this.prisma.$queryRawUnsafe<ObservationTermRow[]>(
      `
        SELECT
          term.term_id,
          coalesce(term.term_text, term.name, term.label, term.normalized_term, term.term_id::text) AS label,
          coalesce(term.term_type, term.type) AS term_type,
          count(link.*) AS total
        FROM observation_term term
        LEFT JOIN species_observation_term link
          ON link.term_id = term.term_id
        GROUP BY term.term_id, label, term_type
        ORDER BY total DESC, label ASC
        LIMIT 80
      `,
    );

    return rows.map((row) => ({
      termId: String(row.term_id),
      label: row.label,
      termType: row.term_type,
      total: Number(row.total),
    }));
  }

  private async buildFilterSql(filter: ConservationFilter, startIndex: number) {
    const clauses = [
      'profile.fetch_status IN (\'ok\', \'success\')',
      `EXISTS (
        SELECT 1
        FROM conservation_terms valid_category
        WHERE valid_category.term_type = 'vnredlist_red_list_category'
          AND valid_category.category_code = profile.redlist_category
      )`,
    ];
    const values: unknown[] = [];

    if (filter.query) {
      values.push(filter.query);
      clauses.push(`
        (
          coalesce(animal.ten_viet_nam, plant.ten_viet_nam, insect.ten_viet_nam, profile.vietnamese_name, '') ILIKE '%' || $${startIndex + values.length - 1} || '%'
          OR coalesce(animal.ten_latin, plant.ten_latin, insect.ten_latin, profile.scientific_name, '') ILIKE '%' || $${startIndex + values.length - 1} || '%'
          OR coalesce(profile.family, animal.ho, plant.ho, insect.ho, '') ILIKE '%' || $${startIndex + values.length - 1} || '%'
        )
      `);
    }

    if (filter.category) {
      values.push(filter.category);
      clauses.push(`profile.redlist_category = $${startIndex + values.length - 1}`);
    }

    if (filter.sourceTable) {
      values.push(filter.sourceTable);
      clauses.push(`match.source_table = $${startIndex + values.length - 1}`);
    }

    if (filter.observationTermId && (await this.hasObservationTermTables())) {
      values.push(filter.observationTermId);
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM species_observation_term observation_link
          WHERE observation_link.source_table = match.source_table
            AND observation_link.species_id = match.species_id
            AND observation_link.term_id = $${startIndex + values.length - 1}::bigint
        )
      `);
    }

    return {
      whereSql: clauses.join('\n          AND '),
      values,
    };
  }

  private async hasObservationTermTables(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT count(*) AS total
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('observation_term', 'species_observation_term')
    `;

    return Number(rows[0]?.total ?? 0) === 2;
  }
}
