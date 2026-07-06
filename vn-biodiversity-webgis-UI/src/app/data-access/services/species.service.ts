import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { SpeciesSearchItem, SpeciesSearchResponse } from '../models/species.model';

export interface SpeciesSearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sourceTable?: string;
  className?: string;
  order?: string;
  family?: string;
  genus?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SpeciesService {
  private readonly api = inject(HttpApiService);

  search(params: SpeciesSearchParams = {}) {
    let httpParams = new HttpParams();

    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }

    if (params.page) {
      httpParams = httpParams.set('page', params.page);
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit);
    }

    for (const key of ['sourceTable', 'className', 'order', 'family', 'genus'] as const) {
      if (params[key]?.trim()) {
        httpParams = httpParams.set(key, params[key].trim());
      }
    }

    return this.api
      .get<SpeciesSearchResponse>(API_ENDPOINTS.speciesSearch, httpParams)
      .pipe(map((response) => ({ ...response, items: response.items.map((item) => this.withAbsoluteImageUrl(item)) })));
  }

  private withAbsoluteImageUrl(item: SpeciesSearchItem): SpeciesSearchItem {
    if (!item.imageUrl) {
      return item;
    }

    return {
      ...item,
      imageUrl: this.api.buildUrl(item.imageUrl),
    };
  }
}
