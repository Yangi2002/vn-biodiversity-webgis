import { Injectable } from '@nestjs/common';
import type { StatsDashboardQueryDto } from './dto/stats-query.dto';
import { StatsRepository } from './stats.repository';
import type { StatsDashboard, StatsSummary } from './types/stats-dashboard.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';

@Injectable()
export class StatsService {
  private readonly dashboardCache = new TtlCache<StatsDashboard>(900_000, 120);
  private readonly summaryCache = new TtlCache<StatsSummary>(900_000, 80);

  constructor(private readonly statsRepository: StatsRepository) {}

  getSummary(query: StatsDashboardQueryDto) {
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = stableCacheKey('stats:summary', normalizedQuery);

    return this.summaryCache.getOrSet(cacheKey, () => this.statsRepository.getSummary(normalizedQuery));
  }

  getDashboard(query: StatsDashboardQueryDto) {
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = stableCacheKey('stats:dashboard', normalizedQuery);

    return this.dashboardCache.getOrSet(cacheKey, () => this.statsRepository.getDashboard(normalizedQuery));
  }

  private normalizeQuery(query: StatsDashboardQueryDto): StatsDashboardQueryDto {
    return {
      basisOfRecord: query.basisOfRecord?.trim() || 'all',
      hasImage: query.hasImage || 'all',
      sourceGroup: query.sourceGroup || 'all',
      yearFrom: query.yearFrom?.trim() || '',
      yearTo: query.yearTo?.trim() || '',
    };
  }
}
