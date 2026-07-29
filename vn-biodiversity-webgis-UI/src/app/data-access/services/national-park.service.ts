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
    const metadataUrls = this.extractMetadataImageUrls(detail.imageMetadata);
    const localUrls = detail.localImagePaths.map((_, index) =>
      this.api.buildUrl(API_ENDPOINTS.nationalParkImage(detail.parkId, index + 1)),
    );
    const imageUrls = [...detail.imageUrls, ...metadataUrls, ...localUrls]
      .map((imageUrl) => this.toAbsoluteUrl(imageUrl) ?? imageUrl)
      .filter((imageUrl, index, list) => imageUrl.length > 0 && list.indexOf(imageUrl) === index);

    return {
      ...this.withAbsoluteImageUrls(detail),
      imageUrls,
    };
  }

  private extractMetadataImageUrls(metadata: unknown): string[] {
    const items = Array.isArray(metadata) ? metadata : metadata && typeof metadata === 'object' ? [metadata] : [];

    return items
      .map((item) => {
        const image = item as NationalParkImageMetadata;
        return image.sourceImageUrl ?? image.source_image_url ?? image.imageUrl ?? image.image_url ?? '';
      })
      .filter(Boolean);
  }

  private toAbsoluteUrl(value: string | null): string | null {
    if (!value) {
      return null;
    }

    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) {
      return value;
    }

    return this.api.buildUrl(value);
  }
}
