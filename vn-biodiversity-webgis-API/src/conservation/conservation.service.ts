import { BadRequestException, Injectable } from '@nestjs/common';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';
import { isSpeciesSourceTable } from '../species/types/species-source.type';
import { ConservationRepository } from './conservation.repository';
import type { ConservationQueryDto } from './dto/conservation-query.dto';
import type { ConservationSpeciesResponse, ConservationSummary } from './types/conservation.type';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

@Injectable()
export class ConservationService {
  private readonly cache = new TtlCache<ConservationSpeciesResponse>(300_000, 80);

  constructor(private readonly conservationRepository: ConservationRepository) {}

  async findEndangeredSpecies(queryDto: ConservationQueryDto): Promise<ConservationSpeciesResponse> {
    const page = this.parsePositiveNumber(queryDto.page, 1);
    const limit = Math.min(this.parsePositiveNumber(queryDto.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const sourceTable = (queryDto.sourceTable ?? '').trim();
    const filter = {
      query: (queryDto.q ?? '').trim(),
      category: (queryDto.category ?? '').trim().toUpperCase(),
      sourceTable: sourceTable && isSpeciesSourceTable(sourceTable) ? sourceTable : '',
      observationTermId: (queryDto.observationTermId ?? '').trim(),
    };

    if (sourceTable && !isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const cacheKey = stableCacheKey('conservation:endangered', { filter, limit, page });
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [items, total, totalProfiles, categories, sourceGroups, categoryOptions, observationTerms] = await Promise.all([
      this.conservationRepository.findSpecies(filter, limit, offset),
      this.conservationRepository.countSpecies(filter),
      this.conservationRepository.countProfiles(),
      this.conservationRepository.categorySummary(filter),
      this.conservationRepository.sourceGroupSummary(filter),
      this.conservationRepository.categoryOptions(),
      this.conservationRepository.observationTerms(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const summary: ConservationSummary = {
      totalMatchedSpecies: total,
      totalProfiles,
      categories,
      sourceGroups,
    };
    const response = {
      items,
      total,
      page,
      limit,
      totalPages,
      summary,
      categoryOptions,
      observationTerms,
    };

    this.cache.set(cacheKey, response);
    return response;
  }

  private parsePositiveNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
