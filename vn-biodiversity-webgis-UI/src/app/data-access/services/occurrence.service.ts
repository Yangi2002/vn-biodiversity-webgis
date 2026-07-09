import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { OccurrenceOverviewQueryDto } from '../dto/occurrence-query.dto';
import type { OccurrenceMapOverview } from '../models/occurrence.model';

@Injectable({
  providedIn: 'root',
})
export class OccurrenceService {
  private readonly api = inject(HttpApiService);

  getMapOverview(query: OccurrenceOverviewQueryDto = {}) {
    let params = new HttpParams();

    if (query.gridSize) {
      params = params.set('gridSize', String(query.gridSize));
    }

    if (query.sourceGroup && query.sourceGroup !== 'all') {
      params = params.set('sourceGroup', query.sourceGroup);
    }

    if (query.yearFrom) {
      params = params.set('yearFrom', String(query.yearFrom));
    }

    if (query.yearTo) {
      params = params.set('yearTo', String(query.yearTo));
    }

    return this.api.get<OccurrenceMapOverview>(API_ENDPOINTS.occurrenceMapOverview, params);
  }
}
