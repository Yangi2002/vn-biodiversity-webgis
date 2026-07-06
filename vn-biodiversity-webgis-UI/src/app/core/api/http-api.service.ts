import { HttpClient } from '@angular/common/http';
import type { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from './api-endpoints';

declare const NG_APP_API_URL: string;

export interface ApiInfoResponse {
  name: string;
  status: string;
}

export interface ApiHealthResponse {
  api: string;
  database: string;
  message?: string;
  startedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class HttpApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = NG_APP_API_URL.replace(/\/$/, '');

  getApiInfo() {
    return this.http.get<ApiInfoResponse>(this.url(API_ENDPOINTS.root));
  }

  getHealth() {
    return this.http.get<ApiHealthResponse>(this.url(API_ENDPOINTS.health));
  }

  get<T>(path: string, params?: HttpParams) {
    return this.http.get<T>(this.url(path), { params });
  }

  buildUrl(path: string) {
    return this.url(path);
  }

  private url(path: string) {
    return `${this.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
