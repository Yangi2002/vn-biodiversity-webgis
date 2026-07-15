import { Injectable } from '@nestjs/common';
import type { StatsDashboardQueryDto } from './dto/stats-query.dto';
import { StatsRepository } from './stats.repository';
import type { StatsDashboard } from './types/stats-dashboard.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';

@Injectable()
export class StatsService {
  private readonly dashboardCache = new TtlCache<StatsDashboard>(900_000, 120);

  constructor(private readonly statsRepository: StatsRepository) {}

  getDashboard(query: StatsDashboardQueryDto) {
    const cacheKey = stableCacheKey('stats:dashboard', {
      basisOfRecord: query.basisOfRecord?.trim() || 'all',
      hasImage: query.hasImage || 'all',
      sourceGroup: query.sourceGroup || 'all',
      yearFrom: query.yearFrom || '',
      yearTo: query.yearTo || '',
    });
    const cachedDashboard = this.dashboardCache.get(cacheKey);

    if (cachedDashboard) {
      return Promise.resolve(cachedDashboard);
    }

    return this.statsRepository.getDashboard(query).then((dashboard) => {
      this.dashboardCache.set(cacheKey, dashboard);
      return dashboard;
    });
  }
}
