import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { ConservationSpeciesItem, ConservationSpeciesResponse } from '../models/conservation.model';

export interface ConservationSearchParams {
  q?: string;
  category?: string;
  sourceTable?: string;
  observationTermId?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ConservationService {
  private readonly api = inject(HttpApiService);

  endangeredSpecies(params: ConservationSearchParams = {}) {
    let httpParams = new HttpParams();

    for (const key of ['q', 'category', 'sourceTable', 'observationTermId'] as const) {
      if (params[key]?.trim()) {
        httpParams = httpParams.set(key, params[key].trim());
      }
    }

    if (params.page) {
      httpParams = httpParams.set('page', params.page);
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit);
    }

    return this.api.get<ConservationSpeciesResponse>(API_ENDPOINTS.endangeredSpecies, httpParams).pipe(
      map((response) => ({
        ...response,
        items: response.items.map((item) => this.withAbsoluteImageUrl(item)),
      })),
    );
  }

  private withAbsoluteImageUrl(item: ConservationSpeciesItem): ConservationSpeciesItem {
    return {
      ...item,
      imageUrl: item.imageUrl ? this.api.buildUrl(item.imageUrl) : item.representativeImageUrl,
    };
  }
}
