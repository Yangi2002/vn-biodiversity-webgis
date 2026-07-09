import { BadRequestException, Injectable } from '@nestjs/common';
import type { OccurrenceOverviewQueryDto } from './dto/occurrence-overview-query.dto';
import { OccurrenceRepository } from './occurrence.repository';
import type { OccurrenceMapOverview } from './types/occurrence-overview.type';

const DEFAULT_GRID_SIZE = 0.5;
const MIN_GRID_SIZE = 0.1;
const MAX_GRID_SIZE = 2;
const MIN_OBSERVED_YEAR = 1500;
const MAX_OBSERVED_YEAR = 2100;
const SOURCE_GROUPS = new Set(['all', 'animal', 'plant', 'insect']);

export interface OccurrenceOverviewFilters {
  sourceGroup: 'all' | 'animal' | 'plant' | 'insect';
  yearFrom?: number;
  yearTo?: number;
}

@Injectable()
export class OccurrenceService {
  constructor(private readonly occurrenceRepository: OccurrenceRepository) {}

  getMapOverview(query: OccurrenceOverviewQueryDto): Promise<OccurrenceMapOverview> {
    const gridSize = this.parseGridSize(query.gridSize);
    const filters = this.parseFilters(query);

    return this.occurrenceRepository.getMapOverview(gridSize, filters);
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
}
