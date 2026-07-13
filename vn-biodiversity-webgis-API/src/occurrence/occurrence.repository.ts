import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { OccurrenceOverviewFilters } from './occurrence.service';
import type {
  OccurrenceCellDetail,
  OccurrenceCellSpecies,
  OccurrenceCellTaxonomyGroup,
  OccurrenceMapCell,
  OccurrenceMapOverview,
  OccurrenceMapSummary,
} from './types/occurrence-overview.type';

const VIETNAM_BOUNDS = {
  minLatitude: 8.2,
  maxLatitude: 23.5,
  minLongitude: 102.1,
  maxLongitude: 109.7,
};

const MAP_LEGEND = [
  { label: 'Th\u1ea5p', color: '#dff3df', min: 1, max: 24 },
  { label: 'Trung b\u00ecnh', color: '#9ad29a', min: 25, max: 99 },
  { label: 'Cao', color: '#3c9f64', min: 100, max: 249 },
  { label: 'R\u1ea5t cao', color: '#0f6f43', min: 250, max: null },
];

interface OverviewRow {
  total_occurrences: bigint | number | null;
  total_species: bigint | number | null;
  animal_species: bigint | number | null;
  plant_species: bigint | number | null;
  insect_species: bigint | number | null;
  unknown_species: bigint | number | null;
  earliest_observed_year: number | null;
  latest_observed_year: number | null;
}

interface CellRow {
  cell_latitude: number;
  cell_longitude: number;
  occurrence_count: bigint | number;
  species_count: bigint | number;
  animal_species: bigint | number;
  plant_species: bigint | number;
  insect_species: bigint | number;
  unknown_species: bigint | number;
}

interface CellSpeciesRow {
  source_table: string;
  source_group: string;
  species_id: string;
  vietnamese_name: string | null;
  scientific_name: string | null;
  family: string | null;
  order_name: string | null;
  class_name: string | null;
  occurrence_count: bigint | number;
}

interface CellTaxonomyRow {
  rank: string;
  canonical_name: string;
  vietnamese_name: string | null;
  species_count: bigint | number;
  occurrence_count: bigint | number;
}

@Injectable()
export class OccurrenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMapOverview(gridSize: number, filters: OccurrenceOverviewFilters): Promise<OccurrenceMapOverview> {
    const queryFilters = this.buildQueryFilters(filters);
    const matchedSpeciesCte = this.buildMatchedSpeciesCte();

    const summaryQuery = this.prisma.$queryRawUnsafe<OverviewRow[]>(
      `
      WITH valid_occurrences AS (
        SELECT
          o.gbif_occurrence_key,
          CASE
            WHEN o.observed_date ~ '^\\d{4}' THEN substring(o.observed_date from 1 for 4)::int
            ELSE NULL
          END AS observed_year
        FROM gbif_occurrences o
        WHERE o.latitude BETWEEN $1 AND $2
          AND o.longitude BETWEEN $3 AND $4
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
          AND coalesce(o.has_geospatial_issue, false) = false
          AND (
            o.observed_date IS NULL
            OR o.observed_date !~ '^\\d{4}'
            OR substring(o.observed_date from 1 for 4)::int BETWEEN $5 AND $6
          )
      ),
      ${matchedSpeciesCte},
      filtered_occurrences AS (
        SELECT
          valid_occurrences.gbif_occurrence_key,
          valid_occurrences.observed_year,
          matched_species.source_table,
          matched_species.species_id,
          matched_species.source_group
        FROM valid_occurrences
        LEFT JOIN matched_species
          ON matched_species.gbif_occurrence_key = valid_occurrences.gbif_occurrence_key
        ${queryFilters.sourceGroupWhereClause}
      ),
      observed_years AS (
        SELECT observed_year
        FROM filtered_occurrences
        WHERE observed_year IS NOT NULL
      )
      SELECT
        count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS total_occurrences,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) AS total_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'animal') AS animal_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'plant') AS plant_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'insect') AS insect_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'unknown') AS unknown_species,
        (SELECT min(observed_year) FROM observed_years) AS earliest_observed_year,
        (SELECT max(observed_year) FROM observed_years) AS latest_observed_year
      FROM filtered_occurrences
      `,
      VIETNAM_BOUNDS.minLatitude,
      VIETNAM_BOUNDS.maxLatitude,
      VIETNAM_BOUNDS.minLongitude,
      VIETNAM_BOUNDS.maxLongitude,
      queryFilters.yearFrom,
      queryFilters.yearTo,
    );

    const cellsQuery = this.prisma.$queryRawUnsafe<CellRow[]>(
      `
      WITH valid_occurrences AS (
        SELECT
          o.gbif_occurrence_key,
          floor(o.latitude / $1) * $1 AS cell_latitude,
          floor(o.longitude / $1) * $1 AS cell_longitude
        FROM gbif_occurrences o
        WHERE o.latitude BETWEEN $2 AND $3
          AND o.longitude BETWEEN $4 AND $5
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
          AND coalesce(o.has_geospatial_issue, false) = false
          AND (
            o.observed_date IS NULL
            OR o.observed_date !~ '^\\d{4}'
            OR substring(o.observed_date from 1 for 4)::int BETWEEN $6 AND $7
          )
      ),
      ${matchedSpeciesCte},
      filtered_occurrences AS (
        SELECT
          valid_occurrences.cell_latitude,
          valid_occurrences.cell_longitude,
          valid_occurrences.gbif_occurrence_key,
          matched_species.source_table,
          matched_species.species_id,
          matched_species.source_group
        FROM valid_occurrences
        LEFT JOIN matched_species
          ON matched_species.gbif_occurrence_key = valid_occurrences.gbif_occurrence_key
        ${queryFilters.sourceGroupWhereClause}
      )
      SELECT
        filtered_occurrences.cell_latitude,
        filtered_occurrences.cell_longitude,
        count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS occurrence_count,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) AS species_count,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'animal') AS animal_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'plant') AS plant_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'insect') AS insect_species,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) FILTER (WHERE filtered_occurrences.source_group = 'unknown') AS unknown_species
      FROM filtered_occurrences
      GROUP BY filtered_occurrences.cell_latitude, filtered_occurrences.cell_longitude
      ORDER BY occurrence_count DESC
      `,
      gridSize,
      VIETNAM_BOUNDS.minLatitude,
      VIETNAM_BOUNDS.maxLatitude,
      VIETNAM_BOUNDS.minLongitude,
      VIETNAM_BOUNDS.maxLongitude,
      queryFilters.yearFrom,
      queryFilters.yearTo,
    );

    const [[summaryRow], cells] = await Promise.all([summaryQuery, cellsQuery]);
    const mappedCells = this.mapCells(cells);

    return {
      bounds: VIETNAM_BOUNDS,
      gridSize,
      summary: this.mapSummary(summaryRow),
      cells: mappedCells,
      legend: MAP_LEGEND,
    };
  }

  async getCellDetail(
    gridSize: number,
    latitude: number,
    longitude: number,
    filters: OccurrenceOverviewFilters,
  ): Promise<OccurrenceCellDetail> {
    const queryFilters = this.buildQueryFilters(filters);
    const matchedSpeciesCte = this.buildMatchedSpeciesCte();
    const speciesUnionCte = this.buildSpeciesUnionCte();

    const queryParams = [
      latitude,
      latitude + gridSize,
      longitude,
      longitude + gridSize,
      queryFilters.yearFrom,
      queryFilters.yearTo,
    ];

    const speciesRowsQuery = this.prisma.$queryRawUnsafe<CellSpeciesRow[]>(
      `
      WITH valid_occurrences AS (
        SELECT
          o.gbif_occurrence_key
        FROM gbif_occurrences o
        WHERE o.latitude >= $1
          AND o.latitude < $2
          AND o.longitude >= $3
          AND o.longitude < $4
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
          AND coalesce(o.has_geospatial_issue, false) = false
          AND (
            o.observed_date IS NULL
            OR o.observed_date !~ '^\\d{4}'
            OR substring(o.observed_date from 1 for 4)::int BETWEEN $5 AND $6
          )
      ),
      ${matchedSpeciesCte},
      ${speciesUnionCte},
      filtered_occurrences AS (
        SELECT
          valid_occurrences.gbif_occurrence_key,
          matched_species.source_table,
          matched_species.species_id,
          matched_species.source_group
        FROM valid_occurrences
        JOIN matched_species
          ON matched_species.gbif_occurrence_key = valid_occurrences.gbif_occurrence_key
        ${queryFilters.sourceGroupWhereClause}
      ),
      species_counts AS (
        SELECT
          source_table,
          species_id,
          source_group,
          count(DISTINCT gbif_occurrence_key) AS occurrence_count
        FROM filtered_occurrences
        GROUP BY source_table, species_id, source_group
      )
      SELECT
        species_counts.source_table,
        species_counts.source_group,
        species_counts.species_id,
        species_union.vietnamese_name,
        species_union.scientific_name,
        species_union.family,
        species_union.order_name,
        species_union.class_name,
        species_counts.occurrence_count
      FROM species_counts
      LEFT JOIN species_union
        ON species_union.source_table = species_counts.source_table
       AND species_union.species_id = species_counts.species_id
      ORDER BY species_counts.occurrence_count DESC, species_union.vietnamese_name NULLS LAST
      LIMIT 8
      `,
      ...queryParams,
    );

    const taxonomyRowsQuery = this.prisma.$queryRawUnsafe<CellTaxonomyRow[]>(
      `
      WITH valid_occurrences AS (
        SELECT
          o.gbif_occurrence_key
        FROM gbif_occurrences o
        WHERE o.latitude >= $1
          AND o.latitude < $2
          AND o.longitude >= $3
          AND o.longitude < $4
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
          AND coalesce(o.has_geospatial_issue, false) = false
          AND (
            o.observed_date IS NULL
            OR o.observed_date !~ '^\\d{4}'
            OR substring(o.observed_date from 1 for 4)::int BETWEEN $5 AND $6
          )
      ),
      ${matchedSpeciesCte},
      filtered_occurrences AS (
        SELECT
          valid_occurrences.gbif_occurrence_key,
          matched_species.source_table,
          matched_species.species_id,
          matched_species.source_group
        FROM valid_occurrences
        JOIN matched_species
          ON matched_species.gbif_occurrence_key = valid_occurrences.gbif_occurrence_key
        ${queryFilters.sourceGroupWhereClause}
      )
      SELECT
        parent.rank,
        parent.canonical_name,
        max(vi.name) AS vietnamese_name,
        count(DISTINCT filtered_occurrences.source_table || ':' || filtered_occurrences.species_id) AS species_count,
        count(DISTINCT filtered_occurrences.gbif_occurrence_key) AS occurrence_count
      FROM filtered_occurrences
      JOIN species_taxonomy st
        ON st.source_table = filtered_occurrences.source_table
       AND st.species_id = filtered_occurrences.species_id
      JOIN taxon_closure tc
        ON tc.descendant_taxon_id = st.taxon_id
      JOIN taxa parent
        ON parent.taxon_id = tc.ancestor_taxon_id
       AND parent.rank IN ('kingdom', 'phylum', 'class', 'order', 'family')
      LEFT JOIN taxon_names vi
        ON vi.taxon_id = parent.taxon_id
       AND vi.language_code = 'vi'
       AND vi.name_type = 'common_name'
      GROUP BY parent.rank, parent.canonical_name
      ORDER BY occurrence_count DESC, species_count DESC, parent.rank
      LIMIT 8
      `,
      ...queryParams,
    );

    const [speciesRows, taxonomyRows] = await Promise.all([speciesRowsQuery, taxonomyRowsQuery]);

    return {
      cellId: `${latitude.toFixed(2)}:${longitude.toFixed(2)}`,
      latitude,
      longitude,
      gridSize,
      representativeSpecies: this.mapCellSpecies(speciesRows),
      taxonomyGroups: this.mapCellTaxonomyGroups(taxonomyRows),
    };
  }

  private buildMatchedSpeciesCte(): string {
    return `
      raw_matched_species AS (
        SELECT
          m.gbif_occurrence_key,
          m.source_table,
          m.species_id
        FROM valid_occurrences
        JOIN species_gbif_occurrence_matches m
          ON m.gbif_occurrence_key = valid_occurrences.gbif_occurrence_key
      ),
      species_source_groups AS (
        SELECT
          species_pairs.source_table,
          species_pairs.species_id,
          CASE
            WHEN bool_or(parent.rank = 'kingdom' AND parent.canonical_name = 'Plantae') THEN 'plant'
            WHEN bool_or(parent.rank = 'class' AND parent.canonical_name = 'Insecta') THEN 'insect'
            WHEN bool_or(parent.rank = 'kingdom' AND parent.canonical_name = 'Animalia') THEN 'animal'
            WHEN species_pairs.source_table = 'plant_db_vn' THEN 'plant'
            WHEN species_pairs.source_table = 'insect_db_vn' THEN 'insect'
            WHEN species_pairs.source_table = 'animal_db_vn' THEN 'animal'
            ELSE 'unknown'
          END AS source_group
        FROM (
          SELECT DISTINCT source_table, species_id
          FROM raw_matched_species
        ) species_pairs
        LEFT JOIN species_taxonomy st
          ON st.source_table = species_pairs.source_table
         AND st.species_id = species_pairs.species_id
        LEFT JOIN taxon_closure tc
          ON tc.descendant_taxon_id = st.taxon_id
        LEFT JOIN taxa parent
          ON parent.taxon_id = tc.ancestor_taxon_id
        GROUP BY
          species_pairs.source_table,
          species_pairs.species_id
      ),
      matched_species AS (
        SELECT
          raw_matched_species.gbif_occurrence_key,
          raw_matched_species.source_table,
          raw_matched_species.species_id,
          species_source_groups.source_group
        FROM raw_matched_species
        JOIN species_source_groups
          ON species_source_groups.source_table = raw_matched_species.source_table
         AND species_source_groups.species_id = raw_matched_species.species_id
      )
    `;
  }

  private buildSpeciesUnionCte(): string {
    return `
      species_union AS (
        SELECT
          'animal_db_vn'::text AS source_table,
          species_id,
          ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name,
          ho AS family,
          bo AS order_name,
          lop_nhom AS class_name
        FROM animal_db_vn
        UNION ALL
        SELECT
          'plant_db_vn'::text AS source_table,
          species_id,
          ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name,
          ho AS family,
          bo AS order_name,
          lop_nhom AS class_name
        FROM plant_db_vn
        UNION ALL
        SELECT
          'insect_db_vn'::text AS source_table,
          species_id,
          ten_viet_nam AS vietnamese_name,
          ten_latin AS scientific_name,
          ho AS family,
          bo AS order_name,
          lop_nhom AS class_name
        FROM insect_db_vn
      )
    `;
  }

  private buildQueryFilters(filters: OccurrenceOverviewFilters) {
    return {
      yearFrom: filters.yearFrom ?? 1500,
      yearTo: filters.yearTo ?? 2100,
      sourceGroupWhereClause:
        filters.sourceGroup === 'all' ? '' : `WHERE matched_species.source_group = '${filters.sourceGroup}'`,
    };
  }

  private mapSummary(row?: OverviewRow): OccurrenceMapSummary {
    return {
      totalOccurrences: this.toNumber(row?.total_occurrences),
      totalSpecies: this.toNumber(row?.total_species),
      animalSpecies: this.toNumber(row?.animal_species),
      plantSpecies: this.toNumber(row?.plant_species),
      insectSpecies: this.toNumber(row?.insect_species),
      unknownSpecies: this.toNumber(row?.unknown_species),
      earliestObservedYear: row?.earliest_observed_year ?? null,
      latestObservedYear: row?.latest_observed_year ?? null,
    };
  }

  private mapCells(rows: CellRow[]): OccurrenceMapCell[] {
    const maxOccurrences = Math.max(...rows.map((row) => this.toNumber(row.occurrence_count)), 1);

    return rows.map((row) => {
      const latitude = Number(row.cell_latitude);
      const longitude = Number(row.cell_longitude);
      const occurrenceCount = this.toNumber(row.occurrence_count);

      return {
        cellId: `${latitude.toFixed(2)}:${longitude.toFixed(2)}`,
        latitude,
        longitude,
        occurrenceCount,
        speciesCount: this.toNumber(row.species_count),
        animalSpecies: this.toNumber(row.animal_species),
        plantSpecies: this.toNumber(row.plant_species),
        insectSpecies: this.toNumber(row.insect_species),
        unknownSpecies: this.toNumber(row.unknown_species),
        intensity: occurrenceCount / maxOccurrences,
      };
    });
  }

  private mapCellSpecies(rows: CellSpeciesRow[]): OccurrenceCellSpecies[] {
    return rows.map((row) => ({
      sourceTable: row.source_table,
      sourceLabel: this.sourceGroupLabel(row.source_group),
      speciesId: row.species_id,
      vietnameseName: row.vietnamese_name,
      scientificName: row.scientific_name,
      family: row.family,
      orderName: row.order_name,
      className: row.class_name,
      occurrenceCount: this.toNumber(row.occurrence_count),
      detailUrl: `/species/${encodeURIComponent(row.source_table)}/${encodeURIComponent(row.species_id)}`,
    }));
  }

  private sourceGroupLabel(sourceGroup: string): string {
    const labels: Record<string, string> = {
      animal: 'Động vật',
      plant: 'Thực vật',
      insect: 'Côn trùng',
      unknown: 'Chưa phân nhóm',
    };

    return labels[sourceGroup] ?? labels.unknown;
  }

  private mapCellTaxonomyGroups(rows: CellTaxonomyRow[]): OccurrenceCellTaxonomyGroup[] {
    return rows.map((row) => ({
      rank: row.rank,
      canonicalName: row.canonical_name,
      vietnameseName: row.vietnamese_name,
      speciesCount: this.toNumber(row.species_count),
      occurrenceCount: this.toNumber(row.occurrence_count),
    }));
  }

  private toNumber(value: bigint | number | null | undefined): number {
    return Number(value ?? 0);
  }
}

