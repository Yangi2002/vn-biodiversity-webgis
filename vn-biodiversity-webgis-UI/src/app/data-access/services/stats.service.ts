import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { StatsDashboardQueryDto } from '../dto/stats-query.dto';
import type { StatsDashboard } from '../models/stats.model';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private readonly api = inject(HttpApiService);
  private readonly dashboardCache = new Map<string, Observable<StatsDashboard>>();

  getDashboard(query: StatsDashboardQueryDto = {}) {
    const params = this.buildParams(query);
    const cacheKey = params.toString() || 'overview';
    const cached = this.dashboardCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const request = this.api
      .get<StatsDashboard>(API_ENDPOINTS.statsDashboard, params)
      .pipe(
        catchError((error) => {
          this.dashboardCache.delete(cacheKey);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.dashboardCache.set(cacheKey, request);

    if (this.dashboardCache.size > 24) {
      const oldestKey = this.dashboardCache.keys().next().value;

      if (oldestKey) {
        this.dashboardCache.delete(oldestKey);
      }
    }

    return request;
  }

  private buildParams(query: StatsDashboardQueryDto): HttpParams {
    let params = new HttpParams();

    if (query.sourceGroup && query.sourceGroup !== 'all') {
      params = params.set('sourceGroup', query.sourceGroup);
    }

    if (query.yearFrom) {
      params = params.set('yearFrom', query.yearFrom);
    }

    if (query.yearTo) {
      params = params.set('yearTo', query.yearTo);
    }

    if (query.basisOfRecord && query.basisOfRecord !== 'all') {
      params = params.set('basisOfRecord', query.basisOfRecord);
    }

    if (query.hasImage && query.hasImage !== 'all') {
      params = params.set('hasImage', query.hasImage);
    }

    return params;
  }
}
