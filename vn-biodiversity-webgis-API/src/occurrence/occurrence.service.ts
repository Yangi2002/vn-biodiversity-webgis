import { BadRequestException, Injectable } from '@nestjs/common';
import type { OccurrenceCellDetailQueryDto } from './dto/occurrence-cell-detail-query.dto';
import type { OccurrenceOverviewQueryDto } from './dto/occurrence-overview-query.dto';
import type { SpeciesOccurrenceQueryDto } from './dto/species-occurrence-query.dto';
import { OccurrenceRepository } from './occurrence.repository';
import type { OccurrenceCellDetail, OccurrenceMapOverview } from './types/occurrence-overview.type';
import type { SpeciesOccurrenceMap } from './types/species-occurrence.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';
import { isSpeciesSourceTable } from '../species/types/species-source.type';

const DEFAULT_GRID_SIZE = 0.5;
const MIN_GRID_SIZE = 0.1;
const MAX_GRID_SIZE = 2;
const MIN_OBSERVED_YEAR = 1500;
const MAX_OBSERVED_YEAR = 2100;
const SOURCE_GROUPS = new Set(['all', 'animal', 'plant', 'insect']);
const DEFAULT_SPECIES_OCCURRENCE_LIMIT = 500;
const MAX_SPECIES_OCCURRENCE_LIMIT = 1500;
const IMAGE_MODES = new Set(['all', 'with-image', 'without-image']);

export interface OccurrenceOverviewFilters {
  sourceGroup: 'all' | 'animal' | 'plant' | 'insect';
  yearFrom?: number;
  yearTo?: number;
}

@Injectable()
export class OccurrenceService {
  private readonly overviewCache = new TtlCache<OccurrenceMapOverview>(120_000, 60);
  private readonly cellDetailCache = new TtlCache<OccurrenceCellDetail>(300_000, 300);
  private readonly speciesOccurrenceCache = new TtlCache<SpeciesOccurrenceMap>(300_000, 300);

  constructor(private readonly occurrenceRepository: OccurrenceRepository) {}

  getMapOverview(query: OccurrenceOverviewQueryDto): Promise<OccurrenceMapOverview> {
    const gridSize = this.parseGridSize(query.gridSize);
    const filters = this.parseFilters(query);
    const cacheKey = stableCacheKey('occurrence:overview', { filters, gridSize });

    return this.overviewCache.getOrSet(cacheKey, () => this.occurrenceRepository.getMapOverview(gridSize, filters));
  }

  getCellDetail(query: OccurrenceCellDetailQueryDto): Promise<OccurrenceCellDetail> {
    const gridSize = this.parseGridSize(query.gridSize);
    const latitude = this.parseCoordinate(query.latitude, 'latitude', -90, 90);
    const longitude = this.parseCoordinate(query.longitude, 'longitude', -180, 180);
    const filters = this.parseFilters(query);
    const cacheKey = stableCacheKey('occurrence:cell-detail', {
      filters,
      gridSize,
      latitude,
      longitude,
    });

    return this.cellDetailCache.getOrSet(cacheKey, () =>
      this.occurrenceRepository.getCellDetail(gridSize, latitude, longitude, filters),
    );
  }

  getSpeciesOccurrences(
    sourceTable: string,
    speciesId: string,
    query: SpeciesOccurrenceQueryDto,
  ): Promise<SpeciesOccurrenceMap> {
    if (!isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const yearFrom = this.parseYear(query.yearFrom, 'yearFrom') ?? MIN_OBSERVED_YEAR;
    const yearTo = this.parseYear(query.yearTo, 'yearTo') ?? MAX_OBSERVED_YEAR;
    const region = this.parseTextFilter(query.region);
    const basisOfRecord = this.parseTextFilter(query.basisOfRecord);
    const imageMode = query.imageMode?.trim() || 'all';

    if (yearFrom > yearTo) {
      throw new BadRequestException('yearFrom must be lower than yearTo.');
    }

    if (!IMAGE_MODES.has(imageMode)) {
      throw new BadRequestException('Invalid imageMode.');
    }

    const limit = this.parseLimit(query.limit);
    const cacheKey = stableCacheKey('occurrence:species', {
      basisOfRecord,
      imageMode,
      limit,
      region,
      sourceTable,
      speciesId,
      yearFrom,
      yearTo,
    });

    return this.speciesOccurrenceCache.getOrSet(cacheKey, () =>
      this.occurrenceRepository.getSpeciesOccurrences(sourceTable, speciesId, {
        basisOfRecord,
        imageMode,
        limit,
        region,
        yearFrom,
        yearTo,
      }),
    );
  }

  private parseGridSize(value: string | undefined): number {
    if (!value) {
      return DEFAULT_GRID_SIZE;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Invalid grid size.');
    }

    return Math.min(Math.max(parsed, MIN_GRID_SIZE), MAX_GRID_SIZE);
  }

  private parseFilters(query: OccurrenceOverviewQueryDto): OccurrenceOverviewFilters {
    const sourceGroup = query.sourceGroup?.trim() || 'all';

    if (!SOURCE_GROUPS.has(sourceGroup)) {
      throw new BadRequestException('Invalid source group.');
    }

    const yearFrom = this.parseYear(query.yearFrom, 'yearFrom');
    const yearTo = this.parseYear(query.yearTo, 'yearTo');

    if (yearFrom && yearTo && yearFrom > yearTo) {
      throw new BadRequestException('yearFrom must be lower than yearTo.');
    }

    return {
      sourceGroup: sourceGroup as OccurrenceOverviewFilters['sourceGroup'],
      yearFrom,
      yearTo,
    };
  }

  private parseYear(value: string | undefined, fieldName: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < MIN_OBSERVED_YEAR || parsed > MAX_OBSERVED_YEAR) {
      throw new BadRequestException(`Invalid ${fieldName}.`);
    }

    return parsed;
  }

  private parseCoordinate(value: string | undefined, fieldName: string, min: number, max: number): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`Invalid ${fieldName}.`);
    }

    return parsed;
  }

  private parseLimit(value: string | undefined): number {
    if (!value) {
      return DEFAULT_SPECIES_OCCURRENCE_LIMIT;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_SPECIES_OCCURRENCE_LIMIT;
    }

    return Math.min(Math.floor(parsed), MAX_SPECIES_OCCURRENCE_LIMIT);
  }

  private parseTextFilter(value: string | undefined): string | null {
    const parsed = value?.trim();

    if (!parsed || parsed === 'all') {
      return null;
    }

    return parsed.slice(0, 160);
  }
}
