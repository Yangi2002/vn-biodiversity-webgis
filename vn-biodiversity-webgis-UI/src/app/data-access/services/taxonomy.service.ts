import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { TaxonomySearchItem, TaxonomySearchResponse } from '../models/taxonomy.model';

export interface TaxonomySearchParams {
  q?: string;
  rank?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TaxonomyService {
  private readonly api = inject(HttpApiService);

  search(params: TaxonomySearchParams) {
    let httpParams = new HttpParams();

    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }

    if (params.rank) {
      httpParams = httpParams.set('rank', params.rank);
    }

    httpParams = httpParams
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));

    return this.api
      .get<TaxonomySearchResponse>(API_ENDPOINTS.taxonomySearch, httpParams)
      .pipe(
        map((response) => ({
          ...response,
          items: response.items.map((item) => this.withAbsoluteRepresentativeImageUrl(item)),
        })),
      );
  }

  private withAbsoluteRepresentativeImageUrl(item: TaxonomySearchItem): TaxonomySearchItem {
    if (!item.representativeImage) {
      return item;
    }

    return {
      ...item,
      representativeImage: {
        ...item.representativeImage,
        imageUrl: this.api.buildUrl(item.representativeImage.imageUrl),
      },
    };
  }
}
