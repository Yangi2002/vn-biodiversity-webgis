import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { NationalParkQueryDto } from '../dto/national-park-query.dto';
import type {
  NationalParkDetail,
  NationalParkListItem,
  NationalParkListResponse,
  NationalParkMapLayer,
  NationalParkSummary,
} from '../models/national-park.model';

@Injectable({
  providedIn: 'root',
})
export class NationalParkService {
  private readonly api = inject(HttpApiService);

  list(params: NationalParkQueryDto = {}) {
    return this.api
      .get<NationalParkListResponse>(
        API_ENDPOINTS.nationalParks,
        this.toHttpParams(params),
      )
      .pipe(
        map((response) => ({
          ...response,
          items: response.items.map((item) =>
            this.withAbsoluteImageUrls(item),
          ),
        })),
      );
  }

  summary() {
    return this.api.get<NationalParkSummary>(
      API_ENDPOINTS.nationalParksSummary,
    );
  }

  mapLayer() {
    return this.api
      .get<NationalParkMapLayer>(
        API_ENDPOINTS.nationalParksMapLayer,
      )
      .pipe(
        map((response) => ({
          ...response,
          items: response.items.map((item) =>
            this.withAbsoluteImageUrls(item),
          ),
        })),
      );
  }

  getDetail(parkId: string) {
    return this.api
      .get<NationalParkDetail>(
        API_ENDPOINTS.nationalParkDetail(parkId),
      )
      .pipe(
        map((detail) =>
          this.withAbsoluteDetailImageUrls(detail),
        ),
      );
  }

  private toHttpParams(
    params: NationalParkQueryDto,
  ): HttpParams {
    let httpParams = new HttpParams();

    if (params.q?.trim()) {
      httpParams = httpParams.set(
        'q',
        params.q.trim(),
      );
    }

    if (params.source?.trim()) {
      httpParams = httpParams.set(
        'source',
        params.source.trim(),
      );
    }

    if (
      params.hasImage &&
      params.hasImage !== 'all'
    ) {
      httpParams = httpParams.set(
        'hasImage',
        params.hasImage,
      );
    }

    if (params.page) {
      httpParams = httpParams.set(
        'page',
        params.page,
      );
    }

    if (params.limit) {
      httpParams = httpParams.set(
        'limit',
        params.limit,
      );
    }

    return httpParams;
  }

  private withAbsoluteImageUrls<
    T extends NationalParkListItem,
  >(item: T): T {
    return {
      ...item,
      thumbnailUrl: this.toAbsoluteUrl(
        item.thumbnailUrl,
      ),
      primaryImageUrl: this.toAbsoluteUrl(
        item.primaryImageUrl,
      ),
    };
  }

  private withAbsoluteDetailImageUrls(
    detail: NationalParkDetail,
  ): NationalParkDetail {
    // Chỉ dùng ảnh thuộc hồ sơ hiện tại, không lấy toàn bộ imageMetadata.
    const imageUrls = this.uniqueImageUrls(
      [
        detail.primaryImageUrl,
        ...(detail.imageUrls ?? []),
        detail.thumbnailUrl,
      ]
        .filter(
          (imageUrl): imageUrl is string =>
            Boolean(imageUrl?.trim()),
        )
        .filter((imageUrl) =>
          this.isDisplayableNationalParkImageUrl(
            imageUrl,
          ),
        )
        .map((imageUrl) =>
          this.toAbsoluteUrl(imageUrl),
        )
        .filter(
          (imageUrl): imageUrl is string =>
            Boolean(imageUrl),
        ),
    );

    const normalizedDetail =
      this.withAbsoluteImageUrls(detail);

    return {
      ...normalizedDetail,
      primaryImageUrl:
        imageUrls[0] ??
        normalizedDetail.primaryImageUrl ??
        normalizedDetail.thumbnailUrl ??
        null,
      imageUrls,
    };
  }

  private isDisplayableNationalParkImageUrl(
    value: string,
  ): boolean {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
      return false;
    }

    const lowerUrl = trimmedValue.toLowerCase();
    const normalizedUrl = lowerUrl.replace(
      /^(\/api)+(?=\/)/i,
      '',
    );

    if (
      lowerUrl.includes('/flags/') ||
      lowerUrl.includes('gtranslate') ||
      lowerUrl.includes('avatar')
    ) {
      return false;
    }

    if (
      /-90x90\./i.test(trimmedValue) ||
      /\/\d+[^/]*s-90x90\./i.test(
        trimmedValue,
      )
    ) {
      return false;
    }

    return (
      /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(
        trimmedValue,
      ) ||
      normalizedUrl.startsWith(
        '/national-parks/',
      )
    );
  }

  private toAbsoluteUrl(
    value: string | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const imageUrl = value.trim();

    if (!imageUrl) {
      return null;
    }

    if (/^(data:|blob:)/i.test(imageUrl)) {
      return imageUrl;
    }

    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    }

    if (/^https?:\/\//i.test(imageUrl)) {
      try {
        const parsedUrl = new URL(imageUrl);

        if (
          parsedUrl.hostname === 'localhost' ||
          parsedUrl.hostname === '127.0.0.1'
        ) {
          return this.api.buildUrl(
            `${parsedUrl.pathname}${parsedUrl.search}`,
          );
        }

        return imageUrl;
      } catch {
        return imageUrl;
      }
    }

    const normalizedPath = imageUrl.replace(
      /^(\/api)+(?=\/)/i,
      '/api',
    );

    return this.api.buildUrl(normalizedPath);
  }

  private uniqueImageUrls(
    imageUrls: string[],
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const imageUrl of imageUrls) {
      const key = this.imageUrlKey(imageUrl);

      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(imageUrl);
    }

    return result;
  }

  private imageUrlKey(value: string): string {
    return value
      .trim()
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}