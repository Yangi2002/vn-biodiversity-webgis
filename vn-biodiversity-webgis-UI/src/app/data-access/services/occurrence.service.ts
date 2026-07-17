import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { OccurrenceOverviewQueryDto } from '../dto/occurrence-query.dto';
import type { OccurrenceCellDetail, OccurrenceMapOverview, SpeciesOccurrenceMap } from '../models/occurrence.model';

export interface SpeciesOccurrenceQueryDto {
  yearFrom?: string | number;
  yearTo?: string | number;
  region?: string;
  basisOfRecord?: string;
  imageMode?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OccurrenceService {
  private readonly api = inject(HttpApiService);

  getMapOverview(query: OccurrenceOverviewQueryDto = {}) {
    const params = this.buildOverviewParams(query);

    return this.api.get<OccurrenceMapOverview>(API_ENDPOINTS.occurrenceMapOverview, params);
  }

  // Used by the WebGIS detail panel under the map after a grid cell is selected.
  getCellDetail(latitude: number, longitude: number, query: OccurrenceOverviewQueryDto = {}) {
    let params = this.buildOverviewParams(query)
      .set('latitude', String(latitude))
      .set('longitude', String(longitude));

    return this.api.get<OccurrenceCellDetail>(API_ENDPOINTS.occurrenceCellDetail, params);
  }

  getSpeciesOccurrences(sourceTable: string, speciesId: string, query: SpeciesOccurrenceQueryDto = {}) {
    let params = new HttpParams();

    if (query.yearFrom) {
      params = params.set('yearFrom', String(query.yearFrom));
    }

    if (query.yearTo) {
      params = params.set('yearTo', String(query.yearTo));
    }

    if (query.region && query.region !== 'all') {
      params = params.set('region', query.region);
    }

    if (query.basisOfRecord && query.basisOfRecord !== 'all') {
      params = params.set('basisOfRecord', query.basisOfRecord);
    }

    if (query.imageMode && query.imageMode !== 'all') {
      params = params.set('imageMode', query.imageMode);
    }

    if (query.limit) {
      params = params.set('limit', String(query.limit));
    }

    return this.api.get<SpeciesOccurrenceMap>(API_ENDPOINTS.speciesOccurrences(sourceTable, speciesId), params);
  }

  private buildOverviewParams(query: OccurrenceOverviewQueryDto): HttpParams {
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

    return params;
  }
}
