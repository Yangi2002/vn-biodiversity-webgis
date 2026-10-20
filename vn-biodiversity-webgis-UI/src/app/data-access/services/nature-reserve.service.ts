import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type { NatureReserveDetail, NatureReserveDocumentResponse, NatureReserveFilterOptions, NatureReserveListItem, NatureReserveListResponse, NatureReserveSummary } from '../models/nature-reserve.model';

export interface NatureReserveQuery {
  q?: string; province?: string; reserveType?: string; operatingStatus?: string;
  yearFrom?: string; yearTo?: string; areaMin?: string; areaMax?: string;
  sort?: string; page?: number; limit?: number;
}

export interface NatureReserveDocumentQuery {
  q?: string;
  documentType?: string;
  issuingAuthority?: string;
  year?: string | number;
  page?: number;
  limit?: number;
}

type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: 'root' })
export class NatureReserveService {
  private readonly api = inject(HttpApiService);
  list(query: NatureReserveQuery = {}) {
    return this.api.get<NatureReserveListResponse>(API_ENDPOINTS.natureReserves, this.params(query));
  }
  mapLayer() { return this.api.get<NatureReserveListItem[]>(API_ENDPOINTS.natureReserveMapLayer); }
  filterOptions() { return this.api.get<NatureReserveFilterOptions>(API_ENDPOINTS.natureReserveFilterOptions); }
  summary() { return this.api.get<NatureReserveSummary>(API_ENDPOINTS.natureReserveSummary); }
  detail(sourceId: string) { return this.api.get<NatureReserveDetail>(API_ENDPOINTS.natureReserveDetail(sourceId)); }
  documents(query: NatureReserveDocumentQuery = {}) {
    return this.api.get<NatureReserveDocumentResponse>(API_ENDPOINTS.natureReserveDocuments, this.params(query));
  }

  private params<T extends object>(values: T): HttpParams {
    let params = new HttpParams();
    (Object.entries(values) as Array<[string, QueryValue]>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return params;
  }
}
