import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { SpeciesDetailResponse, SpeciesSearchItem, SpeciesSearchResponse } from '../models/species.model';

export interface SpeciesSearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sourceTable?: string;
  className?: string;
  order?: string;
  family?: string;
  genus?: string;
  taxonId?: string;
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

    for (const key of ['sourceTable', 'className', 'order', 'family', 'genus', 'taxonId'] as const) {
      if (params[key]?.trim()) {
        httpParams = httpParams.set(key, params[key].trim());
      }
    }

    return this.api
      .get<SpeciesSearchResponse>(API_ENDPOINTS.speciesSearch, httpParams)
      .pipe(map((response) => ({ ...response, items: response.items.map((item) => this.withAbsoluteImageUrl(item)) })));
  }

  getDetail(sourceTable: string, speciesId: string) {
    return this.api
      .get<SpeciesDetailResponse>(API_ENDPOINTS.speciesDetail(sourceTable, speciesId))
      .pipe(map((response) => this.withAbsoluteDetailImageUrl(response)));
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

  private withAbsoluteDetailImageUrl(detail: SpeciesDetailResponse): SpeciesDetailResponse {
    return {
      ...detail,
      imageUrl: detail.imageUrl ? this.api.buildUrl(detail.imageUrl) : null,
      images: detail.images.map((image) => ({
        ...image,
        imageUrl: this.api.buildUrl(image.imageUrl),
        showpicImageUrl: image.showpicImageUrl ? this.api.buildUrl(image.showpicImageUrl) : null,
      })),
      keywords: (detail.keywords ?? []).map((keyword) => ({
        ...keyword,
        images: keyword.images.map((image) => ({
          ...image,
          imageUrl: this.api.buildUrl(image.imageUrl),
        })),
      })),
    };
  }
}
