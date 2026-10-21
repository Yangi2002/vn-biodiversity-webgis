import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StatsDashboardQueryDto } from './dto/stats-query.dto';
import type {
  StatsDashboard,
  StatsDataQuality,
  StatsGroupMetric,
  StatsIucnCategoryMetric,
  StatsIucnGenusMetric,
  StatsIucnSpeciesMetric,
  StatsNameMetric,
  StatsRegionGroupMetric,
  StatsRegionMetric,
  StatsRegionYearMetric,
  StatsSpeciesShareMetric,
  StatsSpeciesRanking,
  StatsReserveMetric,
  StatsSummary,
  StatsTaxonomyMetric,
  StatsYearMetric,
} from './types/stats-dashboard.type';

interface StatsRow {
  [key: string]: string | number | bigint | null;
}

const SOURCE_GROUP_LABELS: Record<string, string> = {
  animal: 'Động vật',
  plant: 'Thực vật',
  insect: 'Côn trùng',
  fungi: 'Nấm',
  protista: 'Sinh vật nguyên sinh',
  unknown: 'Chưa phân nhóm',
};

const TAXONOMY_RANK_LABELS: Record<string, string> = {
  kingdom: 'Giới',
  phylum: 'Ngành',
  class: 'Lớp',
  order: 'Bộ',
  family: 'Họ',
  genus: 'Chi',
  species: 'Loài',
};

const IUCN_CATEGORY_LABELS: Record<string, string> = {
  EX: 'Tuyệt chủng',
  EW: 'Tuyệt chủng ngoài tự nhiên',
  CR: 'Cực kỳ nguy cấp',
  EN: 'Nguy cấp',
  VU: 'Sắp nguy cấp',
  NT: 'Sắp bị đe dọa',
  LC: 'Ít quan tâm',
  DD: 'Thiếu dữ liệu',
};

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: StatsDashboardQueryDto): Promise<StatsSummary> {
    const filters = this.normalizeFilters(query);

    if (this.canUseFastSummary(filters)) {
      return this.getFastSummary();
    }

    const params = [
      filters.yearFrom,
      filters.yearTo,
      filters.sourceGroup,
      filters.basisOfRecord,
      filters.hasImage,
      filters.search,
      filters.reserveId,
    ];
    const baseCte = this.buildBaseCte(filters.sourceGroup);
    const [summaryRow] = await this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
      SELECT
        count(DISTINCT source_table || ':' || species_id) AS total_species,
        count(DISTINCT gbif_occurrence_key) AS total_occurrences,
        count(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS total_regions,
        min(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS earliest_observed_year,
        max(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS latest_observed_year,
        count(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '') AS image_count
      FROM filtered_occurrences`, ...params);

    return this.mapSummary(summaryRow);
  }

  private async getFastSummary(): Promise<StatsSummary> {
    const [summaryRow] = await this.prisma.$queryRaw<StatsRow[]>`
      WITH valid_occurrences AS (
        SELECT
          gbif_occurrence_key,
          observed_date,
          image_url,
          coalesce(
            nullif(source_payload -> 'gadm' -> 'level1' ->> 'name', ''),
            nullif(source_payload ->> 'gbifRegion', ''),
            nullif(location, '')
          ) AS region
        FROM gbif_occurrences
        WHERE latitude BETWEEN 8.2 AND 23.5
          AND longitude BETWEEN 102.1 AND 109.7
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND coalesce(has_geospatial_issue, false) = false
      )
      SELECT
        (
          (SELECT count(*) FROM animal_db_vn) +
          (SELECT count(*) FROM plant_db_vn) +
          (SELECT count(*) FROM insect_db_vn) +
          (SELECT count(*) FROM fungi_db_vn) +
          (SELECT count(*) FROM algae_db_vn) +
          (SELECT count(*) FROM protista_db_vn)
        ) AS total_species,
        count(gbif_occurrence_key) AS total_occurrences,
        count(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS total_regions,
        min(substring(observed_date from 1 for 4)::int) FILTER (WHERE observed_date ~ '^\\d{4}') AS earliest_observed_year,
        max(substring(observed_date from 1 for 4)::int) FILTER (WHERE observed_date ~ '^\\d{4}') AS latest_observed_year,
        count(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '') AS image_count
      FROM valid_occurrences
    `;

    return this.mapSummary(summaryRow);
  }

  private canUseFastSummary(filters: ReturnType<StatsRepository['normalizeFilters']>): boolean {
    return (
      filters.sourceGroup === 'all' &&
      filters.basisOfRecord === 'all' &&
      filters.hasImage === 'all' &&
      filters.search === '' &&
      filters.reserveId === '' &&
      filters.yearFrom === null &&
      filters.yearTo === null
    );
  }

  async getDashboard(query: StatsDashboardQueryDto): Promise<StatsDashboard> {
    const filters = this.normalizeFilters(query);
    const params = [
      filters.yearFrom,
      filters.yearTo,
      filters.sourceGroup,
      filters.basisOfRecord,
      filters.hasImage,
      filters.search,
      filters.reserveId,
    ];
    const baseCte = this.buildBaseCte(filters.sourceGroup);
    const section = filters.section;

    const [
      [summaryRow],
      speciesGroupRows,
      yearRows,
      regionRows,
      regionYearRows,
      regionGroupRows,
      groupSpeciesRows,
      regionSpeciesRows,
      taxonomyRows,
      basisRows,
      speciesRows,
      reserveRows,
      iucnCategoryRows,
      iucnSpeciesRows,
      iucnGenusRows,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          count(DISTINCT source_table || ':' || species_id) AS total_species,
          count(DISTINCT gbif_occurrence_key) AS total_occurrences,
          count(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS total_regions,
          min(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS earliest_observed_year,
          max(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS latest_observed_year,
          count(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '') AS image_count,
          count(DISTINCT gbif_occurrence_key) FILTER (
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND coalesce(has_geospatial_issue, false) = false
          ) AS valid_coordinates,
          count(DISTINCT gbif_occurrence_key) FILTER (WHERE coalesce(has_geospatial_issue, false) = true) AS geospatial_issues,
          count(DISTINCT gbif_occurrence_key) FILTER (WHERE observed_date IS NULL OR observed_date = '') AS missing_observed_date,
          count(DISTINCT gbif_occurrence_key) FILTER (WHERE image_url IS NOT NULL AND image_url <> '') AS with_images,
          count(DISTINCT gbif_occurrence_key) FILTER (WHERE image_url IS NULL OR image_url = '') AS without_images
        FROM filtered_occurrences`, ...params),
      section === 'composition' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          source_group,
          count(DISTINCT source_table || ':' || species_id) AS species_count,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences
        GROUP BY source_group
        ORDER BY occurrence_count DESC`, ...params) : Promise.resolve([]),
      section === 'temporal' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          observed_year,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT source_table || ':' || species_id) AS species_count
        FROM filtered_occurrences
        WHERE observed_year IS NOT NULL
        GROUP BY observed_year
        ORDER BY observed_year`, ...params) : Promise.resolve([]),
      section === 'composition' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          coalesce(nullif(region, ''), 'Chưa rõ vùng') AS region,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT source_table || ':' || species_id) AS species_count
        FROM filtered_occurrences
        GROUP BY coalesce(nullif(region, ''), 'Chưa rõ vùng')
        ORDER BY occurrence_count DESC
        LIMIT 12`, ...params) : Promise.resolve([]),
      section === 'temporal' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte},
        top_regions AS (
          SELECT coalesce(nullif(region, ''), 'Chưa rõ vùng') AS region
          FROM filtered_occurrences
          WHERE observed_year IS NOT NULL
          GROUP BY coalesce(nullif(region, ''), 'Chưa rõ vùng')
          ORDER BY count(DISTINCT gbif_occurrence_key) DESC
          LIMIT 6
        )
        SELECT
          coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng') AS region,
          filtered_occurrences.observed_year AS year,
          count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) AS species_count
        FROM filtered_occurrences
        JOIN top_regions
          ON top_regions.region = coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng')
        WHERE filtered_occurrences.observed_year IS NOT NULL
        GROUP BY coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng'), filtered_occurrences.observed_year
        ORDER BY region ASC, year ASC`, ...params) : Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      section === 'taxonomy' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT 'order'::text AS rank, order_name AS canonical_name, source_group,
          count(DISTINCT source_table || ':' || species_id) AS species_count,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT region) FILTER (WHERE nullif(region, '') IS NOT NULL) AS region_count
        FROM filtered_occurrences
        WHERE nullif(order_name, '') IS NOT NULL
        GROUP BY order_name, source_group
        ORDER BY species_count DESC, occurrence_count DESC
        LIMIT 100`, ...params) : Promise.resolve([]),
      section === 'composition' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT coalesce(nullif(basis_of_record, ''), 'Chưa rõ') AS name,
          count(DISTINCT gbif_occurrence_key) AS count
        FROM filtered_occurrences
        GROUP BY coalesce(nullif(basis_of_record, ''), 'Chưa rõ')
        ORDER BY count DESC
        LIMIT 10`, ...params) : Promise.resolve([]),
      Promise.resolve([]),
      section === 'reserves' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT reserve.source_id, reserve.name, reserve.reserve_type, reserve.province,
          count(DISTINCT occurrence.gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT occurrence.source_table || ':' || occurrence.species_id) AS species_count
        FROM filtered_occurrences AS occurrence
        JOIN nature_reserve_occurrence_matches AS reserve_match
          ON reserve_match.gbif_occurrence_key = occurrence.gbif_occurrence_key
        JOIN nature_reserves AS reserve
          ON reserve.source_id = reserve_match.reserve_source_id
        GROUP BY reserve.source_id, reserve.name, reserve.reserve_type, reserve.province
        ORDER BY species_count DESC, occurrence_count DESC, reserve.name
        LIMIT 40`, ...params) : Promise.resolve([]),
      section === 'iucn' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT upper(trim(profile.redlist_category)) AS category,
          count(DISTINCT occurrence.source_table || ':' || occurrence.species_id) AS species_count,
          count(DISTINCT occurrence.gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences AS occurrence
        JOIN species_vnredlist_matches AS match
          ON match.source_table = occurrence.source_table
         AND match.species_id = occurrence.species_id
        JOIN vnredlist_profiles AS profile ON profile.profile_id = match.profile_id
        WHERE upper(trim(profile.redlist_category)) IN ('EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD')
        GROUP BY upper(trim(profile.redlist_category))
        ORDER BY CASE upper(trim(profile.redlist_category))
          WHEN 'EX' THEN 1 WHEN 'EW' THEN 2 WHEN 'CR' THEN 3 WHEN 'EN' THEN 4
          WHEN 'VU' THEN 5 WHEN 'NT' THEN 6 WHEN 'LC' THEN 7 ELSE 8 END`, ...params) : Promise.resolve([]),
      section === 'iucn' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT occurrence.source_table, occurrence.species_id,
          max(occurrence.vietnamese_name) AS vietnamese_name,
          max(occurrence.scientific_name) AS scientific_name,
          max(coalesce(nullif(profile.genus, ''), occurrence.genus_name)) AS genus,
          max(occurrence.source_group) AS source_group,
          upper(trim(profile.redlist_category)) AS category,
          max(profile.redlist_criteria) AS criteria,
          count(DISTINCT occurrence.gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences AS occurrence
        JOIN species_vnredlist_matches AS match
          ON match.source_table = occurrence.source_table
         AND match.species_id = occurrence.species_id
        JOIN vnredlist_profiles AS profile ON profile.profile_id = match.profile_id
        WHERE upper(trim(profile.redlist_category)) IN ('EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD')
        GROUP BY occurrence.source_table, occurrence.species_id, upper(trim(profile.redlist_category))
        ORDER BY CASE upper(trim(profile.redlist_category))
          WHEN 'EX' THEN 1 WHEN 'EW' THEN 2 WHEN 'CR' THEN 3 WHEN 'EN' THEN 4
          WHEN 'VU' THEN 5 WHEN 'NT' THEN 6 WHEN 'LC' THEN 7 ELSE 8 END,
          occurrence_count DESC
        LIMIT 120`, ...params) : Promise.resolve([]),
      section === 'iucn' ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT coalesce(nullif(profile.genus, ''), occurrence.genus_name, 'Chưa rõ') AS genus,
          upper(trim(profile.redlist_category)) AS category,
          max(occurrence.source_group) AS source_group,
          count(DISTINCT occurrence.source_table || ':' || occurrence.species_id) AS species_count,
          count(DISTINCT occurrence.gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences AS occurrence
        JOIN species_vnredlist_matches AS match
          ON match.source_table = occurrence.source_table
         AND match.species_id = occurrence.species_id
        JOIN vnredlist_profiles AS profile ON profile.profile_id = match.profile_id
        WHERE upper(trim(profile.redlist_category)) IN ('EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD')
        GROUP BY coalesce(nullif(profile.genus, ''), occurrence.genus_name, 'Chưa rõ'), upper(trim(profile.redlist_category))
        ORDER BY species_count DESC, occurrence_count DESC
        LIMIT 60`, ...params) : Promise.resolve([]),
      /* legacy group-detail queries are intentionally not executed; dashboard sections load independently. */
      ...([] as Promise<StatsRow[]>[]),
    ]);

    return {
      summary: this.mapSummary(summaryRow),
      speciesGroups: this.mapSpeciesGroups(speciesGroupRows),
      occurrencesByYear: this.mapYears(yearRows),
      occurrencesByRegion: this.mapRegions(regionRows),
      regionYearBreakdown: this.mapRegionYears(regionYearRows),
      regionGroupBreakdown: this.mapRegionGroups(regionGroupRows),
      groupSpeciesComposition: this.mapSpeciesShares(groupSpeciesRows),
      regionSpeciesComposition: this.mapSpeciesShares(regionSpeciesRows),
      taxonomyHighlights: this.mapTaxonomyHighlights(taxonomyRows),
      basisOfRecord: this.mapNameMetrics(basisRows),
      dataQuality: this.mapDataQuality(summaryRow),
      speciesRanking: this.mapSpeciesRanking(speciesRows),
      reserveBreakdown: this.mapReserveMetrics(reserveRows),
      iucnCategories: this.mapIucnCategories(iucnCategoryRows),
      iucnSpecies: this.mapIucnSpecies(iucnSpeciesRows),
      iucnGenera: this.mapIucnGenera(iucnGenusRows),
    };
  }

  private buildBaseCte(sourceGroup: string): string {
    const speciesUnionSql = this.buildSpeciesUnionSql(sourceGroup);

    return `
      WITH species_union AS (
        ${speciesUnionSql}
      ),
      raw_occurrences AS (
        SELECT *
        FROM (
          SELECT
            o.gbif_occurrence_key,
            o.latitude,
            o.longitude,
            o.observed_date,
            o.stats_observed_year AS observed_year,
            o.basis_of_record,
            o.image_url,
            o.has_geospatial_issue,
            o.stats_region AS region,
            m.source_table,
            m.species_id
          FROM species_gbif_occurrence_matches m
          JOIN gbif_occurrences o
            ON o.gbif_occurrence_key = m.gbif_occurrence_key
          WHERE o.latitude BETWEEN 8.2 AND 23.5
            AND o.longitude BETWEEN 102.1 AND 109.7
            AND o.latitude IS NOT NULL
            AND o.longitude IS NOT NULL
        ) occurrence_scope
        WHERE ($1::int IS NULL OR occurrence_scope.observed_year >= $1::int)
          AND ($2::int IS NULL OR occurrence_scope.observed_year <= $2::int)
      ),
      filtered_occurrences AS (
        SELECT
          raw_occurrences.*,
          species_union.vietnamese_name,
          species_union.scientific_name,
          species_union.class_group,
          species_union.family,
          species_union.order_name,
          species_union.genus_name,
          species_union.source_group
        FROM raw_occurrences
        JOIN species_union
          ON species_union.source_table = raw_occurrences.source_table
         AND species_union.species_id = raw_occurrences.species_id
        WHERE ($3::text = 'all' OR species_union.source_group = $3::text)
          AND ($4::text = 'all' OR raw_occurrences.basis_of_record = $4::text)
          AND (
            $5::text = 'all'
            OR ($5::text = 'true' AND raw_occurrences.image_url IS NOT NULL AND raw_occurrences.image_url <> '')
            OR ($5::text = 'false' AND (raw_occurrences.image_url IS NULL OR raw_occurrences.image_url = ''))
          )
          AND (
            $6::text = ''
            OR concat_ws(' ',
              species_union.species_id,
              species_union.vietnamese_name,
              species_union.scientific_name,
              species_union.class_group,
              species_union.family,
              species_union.order_name,
              species_union.genus_name,
              raw_occurrences.region
            ) ILIKE '%' || $6::text || '%'
          )
          AND (
            $7::text = ''
            OR EXISTS (
              SELECT 1
              FROM nature_reserve_occurrence_matches reserve_filter
              WHERE reserve_filter.gbif_occurrence_key = raw_occurrences.gbif_occurrence_key
                AND reserve_filter.reserve_source_id = $7::text
            )
          )
      )
    `;
  }

  private buildSpeciesUnionSql(sourceGroup: string): string {
    const animalSql = `
        SELECT 'animal_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'animal'::text AS source_group
        FROM animal_db_vn`;
    const plantSql = `
        SELECT 'plant_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'plant'::text AS source_group
        FROM plant_db_vn`;
    const insectSql = `
        SELECT 'insect_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'insect'::text AS source_group
        FROM insect_db_vn`;
    const fungiSql = `
        SELECT 'fungi_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'fungi'::text AS source_group
        FROM fungi_db_vn`;
    const algaeSql = `
        SELECT 'algae_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'protista'::text AS source_group
        FROM algae_db_vn`;
    const protistaSql = `
        SELECT 'protista_db_vn'::text AS source_table, species_id, ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name, lop_nhom AS class_group, ho AS family, bo AS order_name,
          nullif(split_part(trim(coalesce(ten_latin, '')), ' ', 1), '') AS genus_name,
          'protista'::text AS source_group
        FROM protista_db_vn`;

    if (sourceGroup === 'animal') {
      return animalSql;
    }

    if (sourceGroup === 'plant') {
      return plantSql;
    }

    if (sourceGroup === 'insect') {
      return insectSql;
    }

    if (sourceGroup === 'fungi') {
      return fungiSql;
    }

    if (sourceGroup === 'protista') {
      return `${algaeSql}
        UNION ALL
        ${protistaSql}`;
    }

    return `${animalSql}
        UNION ALL
        ${plantSql}
        UNION ALL
        ${insectSql}
        UNION ALL
        ${fungiSql}
        UNION ALL
        ${algaeSql}
        UNION ALL
        ${protistaSql}`;
  }

  private normalizeFilters(query: StatsDashboardQueryDto) {
    const yearFrom = this.parseYear(query.yearFrom);
    const yearTo = this.parseYear(query.yearTo);
    const normalizedYearFrom = yearFrom !== null && yearTo !== null ? Math.min(yearFrom, yearTo) : yearFrom;
    const normalizedYearTo = yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo;

    return {
      section:
        query.section === 'temporal' ||
        query.section === 'taxonomy' ||
        query.section === 'reserves' ||
        query.section === 'iucn'
          ? query.section
          : 'composition',
      yearFrom: normalizedYearFrom,
      yearTo: normalizedYearTo,
      sourceGroup: query.sourceGroup && query.sourceGroup !== 'all' ? query.sourceGroup : 'all',
      basisOfRecord: query.basisOfRecord?.trim() || 'all',
      hasImage: query.hasImage === 'true' || query.hasImage === 'false' ? query.hasImage : 'all',
      search: query.search?.trim() || '',
      reserveId: query.reserveId?.trim() || '',
    };
  }

  private parseYear(value: string | undefined): number | null {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }

  private mapSummary(row: StatsRow | undefined): StatsSummary {
    return {
      totalSpecies: this.toNumber(row?.total_species),
      totalOccurrences: this.toNumber(row?.total_occurrences),
      totalRegions: this.toNumber(row?.total_regions),
      earliestObservedYear: this.toNullableNumber(row?.earliest_observed_year),
      latestObservedYear: this.toNullableNumber(row?.latest_observed_year),
      imageCount: this.toNumber(row?.image_count),
    };
  }

  private mapSpeciesGroups(rows: StatsRow[]): StatsGroupMetric[] {
    return rows.map((row) => {
      const key = String(row.source_group ?? 'unknown');
      return {
        key,
        label: SOURCE_GROUP_LABELS[key] ?? SOURCE_GROUP_LABELS.unknown,
        speciesCount: this.toNumber(row.species_count),
        occurrenceCount: this.toNumber(row.occurrence_count),
      };
    });
  }

  private mapYears(rows: StatsRow[]): StatsYearMetric[] {
    return rows.map((row) => ({
      year: this.toNumber(row.observed_year),
      occurrenceCount: this.toNumber(row.occurrence_count),
      speciesCount: this.toNumber(row.species_count),
    }));
  }

  private mapRegions(rows: StatsRow[]): StatsRegionMetric[] {
    return rows.map((row) => ({
      region: String(row.region ?? 'Chưa rõ vùng'),
      occurrenceCount: this.toNumber(row.occurrence_count),
      speciesCount: this.toNumber(row.species_count),
    }));
  }

  private mapRegionYears(rows: StatsRow[]): StatsRegionYearMetric[] {
    return rows.map((row) => ({
      region: String(row.region ?? 'Chưa rõ vùng'),
      year: this.toNumber(row.year),
      occurrenceCount: this.toNumber(row.occurrence_count),
      speciesCount: this.toNumber(row.species_count),
    }));
  }

  private mapRegionGroups(rows: StatsRow[]): StatsRegionGroupMetric[] {
    return rows.map((row) => {
      const sourceGroup = String(row.source_group ?? 'unknown');

      return {
        region: String(row.region ?? 'Chưa rõ vùng'),
        sourceGroup,
        sourceGroupLabel: SOURCE_GROUP_LABELS[sourceGroup] ?? SOURCE_GROUP_LABELS.unknown,
        occurrenceCount: this.toNumber(row.occurrence_count),
        speciesCount: this.toNumber(row.species_count),
      };
    });
  }

  private mapSpeciesShares(rows: StatsRow[]): StatsSpeciesShareMetric[] {
    return rows.map((row) => {
      const sourceGroup = String(row.source_group ?? 'unknown');
      const sourceTable = String(row.source_table);
      const speciesId = String(row.species_id);
      const occurrenceCount = this.toNumber(row.occurrence_count);
      const totalOccurrence = this.toNumber(row.total_occurrence);

      return {
        region: this.toNullableString(row.region),
        sourceGroup,
        sourceGroupLabel: SOURCE_GROUP_LABELS[sourceGroup] ?? SOURCE_GROUP_LABELS.unknown,
        sourceTable,
        speciesId,
        vietnameseName: this.toNullableString(row.vietnamese_name),
        scientificName: this.toNullableString(row.scientific_name),
        family: this.toNullableString(row.family),
        occurrenceCount,
        speciesCount: 1,
        totalOccurrence,
        sharePercent: totalOccurrence ? Number(((occurrenceCount / totalOccurrence) * 100).toFixed(2)) : 0,
        detailUrl: `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
      };
    });
  }

  private mapTaxonomyHighlights(rows: StatsRow[]): StatsTaxonomyMetric[] {
    return rows.map((row) => {
      const rank = String(row.rank ?? 'unknown');
      const sourceGroup = String(row.source_group ?? 'unknown');

      return {
        rank,
        rankLabel: TAXONOMY_RANK_LABELS[rank] ?? rank,
        canonicalName: String(row.canonical_name ?? 'Chưa rõ'),
        vietnameseName: this.toNullableString(row.vietnamese_name),
        sourceGroup,
        sourceGroupLabel: SOURCE_GROUP_LABELS[sourceGroup] ?? SOURCE_GROUP_LABELS.unknown,
        occurrenceCount: this.toNumber(row.occurrence_count),
        speciesCount: this.toNumber(row.species_count),
        regionCount: this.toNumber(row.region_count),
      };
    });
  }

  private mapNameMetrics(rows: StatsRow[]): StatsNameMetric[] {
    return rows.map((row) => ({
      name: String(row.name ?? 'Chưa rõ'),
      count: this.toNumber(row.count),
    }));
  }

  private mapDataQuality(row: StatsRow | undefined): StatsDataQuality {
    return {
      validCoordinates: this.toNumber(row?.valid_coordinates),
      geospatialIssues: this.toNumber(row?.geospatial_issues),
      missingObservedDate: this.toNumber(row?.missing_observed_date),
      withImages: this.toNumber(row?.with_images),
      withoutImages: this.toNumber(row?.without_images),
    };
  }

  private mapSpeciesRanking(rows: StatsRow[]): StatsSpeciesRanking[] {
    return rows.map((row) => ({
      sourceTable: String(row.source_table),
      speciesId: String(row.species_id),
      vietnameseName: this.toNullableString(row.vietnamese_name),
      scientificName: this.toNullableString(row.scientific_name),
      family: this.toNullableString(row.family),
      orderName: this.toNullableString(row.order_name),
      sourceGroup: String(row.source_group ?? 'unknown'),
      occurrenceCount: this.toNumber(row.occurrence_count),
      regionCount: this.toNumber(row.region_count),
      earliestObservedYear: this.toNullableNumber(row.earliest_observed_year),
      latestObservedYear: this.toNullableNumber(row.latest_observed_year),
      detailUrl: `/species/${encodeURIComponent(String(row.source_table))}/${encodeURIComponent(String(row.species_id))}`,
    }));
  }

  private mapReserveMetrics(rows: StatsRow[]): StatsReserveMetric[] {
    return rows.map((row) => ({
      sourceId: String(row.source_id),
      name: String(row.name ?? 'Chưa rõ khu bảo tồn'),
      reserveType: this.toNullableString(row.reserve_type),
      province: this.toNullableString(row.province),
      occurrenceCount: this.toNumber(row.occurrence_count),
      speciesCount: this.toNumber(row.species_count),
    }));
  }

  private mapIucnCategories(rows: StatsRow[]): StatsIucnCategoryMetric[] {
    return rows.map((row) => {
      const category = String(row.category ?? 'DD');

      return {
        category,
        label: IUCN_CATEGORY_LABELS[category] ?? category,
        speciesCount: this.toNumber(row.species_count),
        occurrenceCount: this.toNumber(row.occurrence_count),
      };
    });
  }

  private mapIucnSpecies(rows: StatsRow[]): StatsIucnSpeciesMetric[] {
    return rows.map((row) => {
      const sourceTable = String(row.source_table);
      const speciesId = String(row.species_id);
      const sourceGroup = String(row.source_group ?? 'unknown');

      return {
        sourceTable,
        speciesId,
        vietnameseName: this.toNullableString(row.vietnamese_name),
        scientificName: this.toNullableString(row.scientific_name),
        genus: this.toNullableString(row.genus),
        sourceGroup,
        sourceGroupLabel: SOURCE_GROUP_LABELS[sourceGroup] ?? SOURCE_GROUP_LABELS.unknown,
        category: String(row.category ?? 'DD'),
        criteria: this.toNullableString(row.criteria),
        occurrenceCount: this.toNumber(row.occurrence_count),
        detailUrl: `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
      };
    });
  }

  private mapIucnGenera(rows: StatsRow[]): StatsIucnGenusMetric[] {
    return rows.map((row) => {
      const sourceGroup = String(row.source_group ?? 'unknown');

      return {
        genus: String(row.genus ?? 'Chưa rõ'),
        category: String(row.category ?? 'DD'),
        sourceGroup,
        sourceGroupLabel: SOURCE_GROUP_LABELS[sourceGroup] ?? SOURCE_GROUP_LABELS.unknown,
        speciesCount: this.toNumber(row.species_count),
        occurrenceCount: this.toNumber(row.occurrence_count),
      };
    });
  }

  private toNumber(value: string | number | bigint | null | undefined): number {
    return Number(value ?? 0);
  }

  private toNullableNumber(value: string | number | bigint | null | undefined): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private toNullableString(value: string | number | bigint | null | undefined): string | null {
    return value === null || value === undefined ? null : String(value);
  }
}
