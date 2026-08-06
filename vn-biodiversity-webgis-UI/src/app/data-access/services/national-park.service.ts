import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { NationalParkQueryDto } from '../dto/national-park-query.dto';
import type {
  NationalParkDetail,
  NationalParkImageMetadata,
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
      .get<NationalParkListResponse>(API_ENDPOINTS.nationalParks, this.toHttpParams(params))
      .pipe(map((response) => ({ ...response, items: response.items.map((item) => this.withAbsoluteImageUrls(item)) })));
  }

  summary() {
    return this.api.get<NationalParkSummary>(API_ENDPOINTS.nationalParksSummary);
  }

  mapLayer() {
    return this.api.get<NationalParkMapLayer>(API_ENDPOINTS.nationalParksMapLayer).pipe(
      map((response) => ({
        ...response,
        items: response.items.map((item) => this.withAbsoluteImageUrls(item)),
      })),
    );
  }

  getDetail(parkId: string) {
    return this.api
      .get<NationalParkDetail>(API_ENDPOINTS.nationalParkDetail(parkId))
      .pipe(map((detail) => this.withAbsoluteDetailImageUrls(detail)));
  }

  private toHttpParams(params: NationalParkQueryDto): HttpParams {
    let httpParams = new HttpParams();

    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }

    if (params.source?.trim()) {
      httpParams = httpParams.set('source', params.source.trim());
    }

    if (params.hasImage && params.hasImage !== 'all') {
      httpParams = httpParams.set('hasImage', params.hasImage);
    }

    if (params.page) {
      httpParams = httpParams.set('page', params.page);
    }

    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit);
    }

    return httpParams;
  }

  private withAbsoluteImageUrls<T extends NationalParkListItem>(item: T): T {
    return {
      ...item,
      thumbnailUrl: this.toAbsoluteUrl(item.thumbnailUrl),
      primaryImageUrl: this.toAbsoluteUrl(item.primaryImageUrl),
    };
  }

  private withAbsoluteDetailImageUrls(detail: NationalParkDetail): NationalParkDetail {
    const metadataUrls = this.extractDisplayableMetadataImageUrls(detail);
    const fallbackUrls = [detail.primaryImageUrl, ...detail.imageUrls, detail.thumbnailUrl]
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
      .filter((imageUrl) => this.isDisplayableNationalParkImageUrl(imageUrl));
    const imageUrls = this.uniqueImageUrls(
      [...metadataUrls, ...fallbackUrls]
        .map((imageUrl) => this.toAbsoluteUrl(imageUrl) ?? imageUrl)
        .filter((imageUrl): imageUrl is string => Boolean(imageUrl)),
    );

    return {
      ...this.withAbsoluteImageUrls(detail),
      primaryImageUrl: imageUrls[0] ?? this.toAbsoluteUrl(detail.primaryImageUrl),
      imageUrls,
    };
  }

  private extractDisplayableMetadataImageUrls(detail: NationalParkDetail): string[] {
    const items = Array.isArray(detail.imageMetadata)
      ? detail.imageMetadata
      : detail.imageMetadata && typeof detail.imageMetadata === 'object'
        ? [detail.imageMetadata]
        : [];

    return items
      .map((item): string => {
        const image = item as NationalParkImageMetadata;

        if (!this.isDisplayableNationalParkImage(image)) {
          return '';
        }

        const imageOrder = Number(image.imageOrder ?? image.image_order);
        const localPath = image.localPath ?? image.local_path;

        if (localPath && Number.isFinite(imageOrder) && imageOrder > 0) {
          return API_ENDPOINTS.nationalParkImage(detail.parkId, imageOrder);
        }

        return image.sourceImageUrl ?? image.source_image_url ?? image.imageUrl ?? image.image_url ?? '';
      })
      .filter(Boolean);
  }

  private isDisplayableNationalParkImage(image: NationalParkImageMetadata): boolean {
    const url = image.sourceImageUrl ?? image.source_image_url ?? image.imageUrl ?? image.image_url ?? '';
    const width = Number(image.width);
    const height = Number(image.height);

    if (!this.isDisplayableNationalParkImageUrl(url)) {
      return false;
    }

    if (Number.isFinite(width) && Number.isFinite(height)) {
      return width >= 250 && height >= 180;
    }

    return true;
  }

  private isDisplayableNationalParkImageUrl(value: string): boolean {
    const trimmedValue = value.trim();
    const url = trimmedValue.toLowerCase();
    const normalizedUrl = url.replace(/^(\/api)+(?=\/)/, '');

    if (!url) {
      return false;
    }

    if (url.includes('/flags/') || url.includes('gtranslate') || url.includes('avatar')) {
      return false;
    }

    if (/-90x90\./i.test(trimmedValue) || /\/\d+[^/]*s-90x90\./i.test(trimmedValue)) {
      return false;
    }

    return /\.(jpe?g|png|webp)(\?|$)/i.test(trimmedValue) || normalizedUrl.startsWith('/national-parks/');
  }

  private toAbsoluteUrl(value: string | null): string | null {
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

    if (/^https?:\/\//i.test(imageUrl)) {
      try {
        const parsedUrl = new URL(imageUrl);
        const pathWithQuery = `${parsedUrl.pathname}${parsedUrl.search}`;

        if (
          parsedUrl.hostname === 'localhost' ||
          pathWithQuery.startsWith('/api/') ||
          pathWithQuery.startsWith('/national-parks/')
        ) {
          return this.api.buildUrl(pathWithQuery);
        }

        return imageUrl;
      } catch {
        return imageUrl;
      }
    }

    return this.api.buildUrl(imageUrl.replace(/^(\/api)+(?=\/)/i, '/api'));
  }

  private uniqueImageUrls(imageUrls: string[]): string[] {
    const seen = new Set<string>();

    return imageUrls.filter((imageUrl) => {
      const key = this.imageUrlKey(imageUrl);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private imageUrlKey(value: string): string {
    const normalizedValue = value
      .trim()
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^(\/api)+(?=\/)/i, '/api')
      .replace(/\/+$/, '');

    const nationalParkImageMatch = normalizedValue.match(/\/national-parks\/([^/]+)\/images\/(\d+)/i);

    if (nationalParkImageMatch) {
      return `national-park:${decodeURIComponent(nationalParkImageMatch[1])}:image:${nationalParkImageMatch[2]}`;
    }

    return normalizedValue.toLowerCase();
  }
}
