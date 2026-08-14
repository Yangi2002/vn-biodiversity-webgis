import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { finalize, map, Observable, of, shareReplay, take, tap } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { SpeciesDetailResponse, SpeciesSearchItem, SpeciesSearchResponse } from '../models/species.model';

export interface SpeciesSearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sourceTable?: string;
  kingdom?: string;
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
  private static readonly SEARCH_CACHE_TTL_MS = 60_000;

  private readonly api = inject(HttpApiService);
  private readonly searchCache = new Map<string, { expiresAt: number; response: SpeciesSearchResponse }>();
  private readonly pendingSearches = new Map<string, Observable<SpeciesSearchResponse>>();

  search(params: SpeciesSearchParams = {}) {
    const normalizedParams = this.normalizeSearchParams(params);
    const cacheKey = this.searchCacheKey(normalizedParams);
    const cached = this.searchCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return of(cached.response);
    }

    if (cached) {
      this.searchCache.delete(cacheKey);
    }

    const pending = this.pendingSearches.get(cacheKey);

    if (pending) {
      return pending;
    }

    let httpParams = new HttpParams();

    if (normalizedParams.q) {
      httpParams = httpParams.set('q', normalizedParams.q);
    }

    if (normalizedParams.page) {
      httpParams = httpParams.set('page', normalizedParams.page);
    }

    if (normalizedParams.limit) {
      httpParams = httpParams.set('limit', normalizedParams.limit);
    }

    for (const key of ['sourceTable', 'kingdom', 'className', 'order', 'family', 'genus', 'taxonId'] as const) {
      if (normalizedParams[key]) {
        httpParams = httpParams.set(key, normalizedParams[key]);
      }
    }

    const request = this.api
      .get<SpeciesSearchResponse>(API_ENDPOINTS.speciesSearch, httpParams)
      .pipe(
        map((response) => ({ ...response, items: response.items.map((item) => this.withAbsoluteImageUrl(item)) })),
        tap((response) => {
          this.searchCache.set(cacheKey, {
            expiresAt: Date.now() + SpeciesService.SEARCH_CACHE_TTL_MS,
            response,
          });
          this.pruneSearchCache();
        }),
        finalize(() => this.pendingSearches.delete(cacheKey)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.pendingSearches.set(cacheKey, request);
    return request;
  }

  prefetchSearch(params: SpeciesSearchParams = {}): void {
    this.search(params)
      .pipe(take(1))
      .subscribe({ error: () => undefined });
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
        imageUrl: this.api.buildUrl(this.withImageVersion(image.imageUrl, image)),
        showpicImageUrl: image.showpicImageUrl ? this.api.buildUrl(this.withImageVersion(image.showpicImageUrl, image)) : null,
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

  private withImageVersion(path: string, image: { showpicMetadata?: { showpicId: string; updatedAt: string | null; imageFileSize: number | null } | null }): string {
    const metadata = image.showpicMetadata;

    if (!metadata) {
      return path;
    }

    const version = encodeURIComponent([
      metadata.showpicId,
      metadata.updatedAt ?? '',
      metadata.imageFileSize ?? '',
    ].join('-'));
    const separator = path.includes('?') ? '&' : '?';

    return `${path}${separator}v=${version}`;
  }

  private normalizeSearchParams(params: SpeciesSearchParams): SpeciesSearchParams {
    return {
      q: params.q?.trim() || undefined,
      page: params.page,
      limit: params.limit,
      sourceTable: params.sourceTable?.trim() || undefined,
      kingdom: params.kingdom?.trim() || undefined,
      className: params.className?.trim() || undefined,
      order: params.order?.trim() || undefined,
      family: params.family?.trim() || undefined,
      genus: params.genus?.trim() || undefined,
      taxonId: params.taxonId?.trim() || undefined,
    };
  }

  private searchCacheKey(params: SpeciesSearchParams): string {
    return JSON.stringify([
      params.q ?? '',
      params.page ?? 1,
      params.limit ?? 24,
      params.sourceTable ?? '',
      params.kingdom ?? '',
      params.className ?? '',
      params.order ?? '',
      params.family ?? '',
      params.genus ?? '',
      params.taxonId ?? '',
    ]);
  }

  private pruneSearchCache(): void {
    if (this.searchCache.size <= 80) {
      return;
    }

    const now = Date.now();

    for (const [key, cached] of this.searchCache) {
      if (cached.expiresAt <= now || this.searchCache.size > 60) {
        this.searchCache.delete(key);
      }
    }
  }
}
