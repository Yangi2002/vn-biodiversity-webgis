import { Injectable } from '@nestjs/common';
import type { TaxonomySearchQueryDto } from './dto/taxonomy-search-query.dto';
import { TaxonomyRepository } from './taxonomy.repository';
import type { TaxonomySearchResponse } from './types/taxonomy-search-result.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';

@Injectable()
export class TaxonomyService {
  private readonly searchCache = new TtlCache<TaxonomySearchResponse>(300_000, 120);

  constructor(private readonly taxonomyRepository: TaxonomyRepository) {}

  async search(query: TaxonomySearchQueryDto): Promise<TaxonomySearchResponse> {
    const q = String(query.q ?? '').trim();
    const rank = String(query.rank ?? '').trim();
    const page = this.parsePositiveInteger(query.page, 1);
    const limit = Math.min(this.parsePositiveInteger(query.limit, 20), 60);
    const offset = (page - 1) * limit;
    const cacheKey = stableCacheKey('taxonomy:search', { limit, page, q, rank });
    const cachedResponse = this.searchCache.get(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const [items, total, ranks] = await Promise.all([
      this.taxonomyRepository.search(q, rank, limit, offset),
      this.taxonomyRepository.count(q, rank),
      this.taxonomyRepository.rankFacets(q),
    ]);

    const response = {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      query: q,
      rank,
      facets: { ranks },
    };

    this.searchCache.set(cacheKey, response);
    return response;
  }

  private parsePositiveInteger(value: string | number | undefined, fallback: number): number {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback;
  }
}
