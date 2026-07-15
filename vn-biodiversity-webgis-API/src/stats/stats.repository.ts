import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StatsDashboardQueryDto } from './dto/stats-query.dto';
import type {
  StatsDashboard,
  StatsDataQuality,
  StatsGroupMetric,
  StatsNameMetric,
  StatsRegionGroupMetric,
  StatsRegionMetric,
  StatsRegionYearMetric,
  StatsSpeciesShareMetric,
  StatsSpeciesRanking,
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

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: StatsDashboardQueryDto): Promise<StatsDashboard> {
    const filters = this.normalizeFilters(query);
    const params = [filters.yearFrom, filters.yearTo, filters.sourceGroup, filters.basisOfRecord, filters.hasImage];
    const baseCte = this.buildBaseCte(filters.sourceGroup);
    const includeGroupDetail = filters.sourceGroup !== 'all';

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
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          source_group,
          count(DISTINCT source_table || ':' || species_id) AS species_count,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences
        GROUP BY source_group
        ORDER BY occurrence_count DESC`, ...params),
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          observed_year,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT source_table || ':' || species_id) AS species_count
        FROM filtered_occurrences
        WHERE observed_year IS NOT NULL
        GROUP BY observed_year
        ORDER BY observed_year`, ...params),
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          coalesce(nullif(region, ''), 'Chưa rõ vùng') AS region,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT source_table || ':' || species_id) AS species_count
        FROM filtered_occurrences
        GROUP BY coalesce(nullif(region, ''), 'Chưa rõ vùng')
        ORDER BY occurrence_count DESC
        LIMIT 12`, ...params),
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte},
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
        ORDER BY region ASC, year ASC`, ...params),
      includeGroupDetail ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte},
        top_regions AS (
          SELECT coalesce(nullif(region, ''), 'Chưa rõ vùng') AS region
          FROM filtered_occurrences
          GROUP BY coalesce(nullif(region, ''), 'Chưa rõ vùng')
          ORDER BY count(DISTINCT gbif_occurrence_key) DESC
          LIMIT 8
        )
        SELECT
          coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng') AS region,
          filtered_occurrences.source_group,
          count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) AS species_count,
          count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences
        JOIN top_regions
          ON top_regions.region = coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng')
        GROUP BY coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng'), filtered_occurrences.source_group
        ORDER BY region ASC, occurrence_count DESC`, ...params) : Promise.resolve([]),
      Promise.resolve([]),
      includeGroupDetail ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte},
        top_regions AS (
          SELECT coalesce(nullif(region, ''), 'Chưa rõ vùng') AS region
          FROM filtered_occurrences
          GROUP BY coalesce(nullif(region, ''), 'Chưa rõ vùng')
          ORDER BY count(DISTINCT gbif_occurrence_key) DESC
          LIMIT 6
        ),
        species_region_counts AS (
          SELECT
            coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng') AS region,
            filtered_occurrences.source_group,
            filtered_occurrences.source_table,
            filtered_occurrences.species_id,
            max(filtered_occurrences.vietnamese_name) AS vietnamese_name,
            max(filtered_occurrences.scientific_name) AS scientific_name,
            max(filtered_occurrences.family) AS family,
            count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS occurrence_count
          FROM filtered_occurrences
          JOIN top_regions
            ON top_regions.region = coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng')
          GROUP BY
            coalesce(nullif(filtered_occurrences.region, ''), 'Chưa rõ vùng'),
            filtered_occurrences.source_group,
            filtered_occurrences.source_table,
            filtered_occurrences.species_id
        ),
        region_totals AS (
          SELECT region, sum(occurrence_count) AS total_occurrence
          FROM species_region_counts
          GROUP BY region
        ),
        ranked_region_species AS (
          SELECT
            species_region_counts.*,
            region_totals.total_occurrence,
            row_number() OVER (
              PARTITION BY species_region_counts.region
              ORDER BY species_region_counts.occurrence_count DESC
            ) AS row_index
          FROM species_region_counts
          JOIN region_totals
            ON region_totals.region = species_region_counts.region
        )
        SELECT *
        FROM ranked_region_species
        WHERE row_index <= 5
        ORDER BY region ASC, occurrence_count DESC`, ...params) : Promise.resolve([]),
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte},
        taxonomy_items AS (
          SELECT 'class'::text AS rank, class_group AS canonical_name, source_group, source_table, species_id, gbif_occurrence_key, region
          FROM filtered_occurrences
          WHERE class_group IS NOT NULL AND class_group <> ''
          UNION ALL
          SELECT 'order'::text AS rank, order_name AS canonical_name, source_group, source_table, species_id, gbif_occurrence_key, region
          FROM filtered_occurrences
          WHERE order_name IS NOT NULL AND order_name <> ''
          UNION ALL
          SELECT 'family'::text AS rank, family AS canonical_name, source_group, source_table, species_id, gbif_occurrence_key, region
          FROM filtered_occurrences
          WHERE family IS NOT NULL AND family <> ''
          UNION ALL
          SELECT 'genus'::text AS rank, genus_name AS canonical_name, source_group, source_table, species_id, gbif_occurrence_key, region
          FROM filtered_occurrences
          WHERE genus_name IS NOT NULL AND genus_name <> ''
        )
        SELECT
          rank,
          canonical_name,
          max(source_group) AS source_group,
          count(DISTINCT source_table || ':' || species_id) AS species_count,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS region_count
        FROM taxonomy_items
        GROUP BY rank, canonical_name
        ORDER BY occurrence_count DESC
        LIMIT 16`, ...params),
      this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          coalesce(nullif(basis_of_record, ''), 'Chưa rõ') AS name,
          count(DISTINCT gbif_occurrence_key) AS count
        FROM filtered_occurrences
        GROUP BY coalesce(nullif(basis_of_record, ''), 'Chưa rõ')
        ORDER BY count DESC
        LIMIT 10`, ...params),
      includeGroupDetail ? this.prisma.$queryRawUnsafe<StatsRow[]>(`${baseCte}
        SELECT
          source_table,
          species_id,
          max(vietnamese_name) AS vietnamese_name,
          max(scientific_name) AS scientific_name,
          max(family) AS family,
          max(order_name) AS order_name,
          max(source_group) AS source_group,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count,
          count(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS region_count,
          min(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS earliest_observed_year,
          max(observed_year) FILTER (WHERE observed_year IS NOT NULL) AS latest_observed_year
        FROM filtered_occurrences
        GROUP BY source_table, species_id
        ORDER BY occurrence_count DESC
        LIMIT 12`, ...params) : Promise.resolve([]),
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
            CASE
              WHEN o.observed_date ~ '^\\d{4}' THEN substring(o.observed_date from 1 for 4)::int
              ELSE NULL
            END AS observed_year,
            o.basis_of_record,
            o.image_url,
            o.has_geospatial_issue,
            coalesce(
              nullif(o.source_payload -> 'gadm' -> 'level1' ->> 'name', ''),
              nullif(o.source_payload ->> 'gbifRegion', ''),
              nullif(o.location, '')
            ) AS region,
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

    if (sourceGroup === 'animal') {
      return animalSql;
    }

    if (sourceGroup === 'plant') {
      return plantSql;
    }

    if (sourceGroup === 'insect') {
      return insectSql;
    }

    return `${animalSql}
        UNION ALL
        ${plantSql}
        UNION ALL
        ${insectSql}`;
  }

  private normalizeFilters(query: StatsDashboardQueryDto) {
    const yearFrom = this.parseYear(query.yearFrom);
    const yearTo = this.parseYear(query.yearTo);
    const normalizedYearFrom = yearFrom !== null && yearTo !== null ? Math.min(yearFrom, yearTo) : yearFrom;
    const normalizedYearTo = yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo;

    return {
      yearFrom: normalizedYearFrom,
      yearTo: normalizedYearTo,
      sourceGroup: query.sourceGroup && query.sourceGroup !== 'all' ? query.sourceGroup : 'all',
      basisOfRecord: query.basisOfRecord?.trim() || 'all',
      hasImage: query.hasImage === 'true' || query.hasImage === 'false' ? query.hasImage : 'all',
    };
  }

  private parseYear(value: string | undefined): number | null {
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
