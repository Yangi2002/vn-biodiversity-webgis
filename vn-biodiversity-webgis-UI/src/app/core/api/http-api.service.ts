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

  /**
   * Ví dụ production:
   * https://sinhthaivnsc.opengis.vn/api
   *
   * Loại bỏ toàn bộ dấu "/" thừa ở cuối.
   */
  private readonly apiUrl = NG_APP_API_URL.trim().replace(/\/+$/, '');

  getApiInfo() {
    return this.http.get<ApiInfoResponse>(
      this.buildUrl(API_ENDPOINTS.root),
    );
  }

  getHealth() {
    return this.http.get<ApiHealthResponse>(
      this.buildUrl(API_ENDPOINTS.health),
    );
  }

  get<T>(path: string, params?: HttpParams) {
    return this.http.get<T>(this.buildUrl(path), {
      params,
    });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(
      this.buildUrl(path),
      body,
    );
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(
      this.buildUrl(path),
      body,
    );
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(
      this.buildUrl(path),
      body,
    );
  }

  delete<T>(path: string, params?: HttpParams) {
    return this.http.delete<T>(
      this.buildUrl(path),
      { params },
    );
  }

  /**
   * Tạo URL gọi backend API.
   *
   * Xử lý được:
   * national-parks/...
   * /national-parks/...
   * api/national-parks/...
   * /api/national-parks/...
   * /api/api/national-parks/...
   * https://domain/api/national-parks/...
   */
  buildUrl(path: string | null | undefined): string {
    if (!path) {
      return this.apiUrl;
    }

    const value = path.trim().replace(/\\/g, '/');

    // URL đã đầy đủ thì không được nối apiUrl thêm lần nữa.
    if (this.isAbsoluteUrl(value)) {
      return this.normalizeAbsoluteUrl(value);
    }

    const normalizedPath = this.normalizeApiPath(value);

    return `${this.apiUrl}${normalizedPath}`;
  }

  /**
   * Chuẩn hóa URL dùng cho hình ảnh/media.
   *
   * Ảnh bên ngoài:
   * https://example.com/image.jpg
   *
   * Ảnh backend:
   * /api/national-parks/.../images/1
   */
  buildMediaUrl(path: string | null | undefined): string {
    if (!path) {
      return '';
    }

    const value = path.trim().replace(/\\/g, '/');

    if (
      value.startsWith('data:') ||
      value.startsWith('blob:')
    ) {
      return value;
    }

    if (this.isAbsoluteUrl(value)) {
      return this.normalizeAbsoluteUrl(value);
    }

    return this.buildUrl(value);
  }

  private normalizeApiPath(path: string): string {
    let value = path.trim().replace(/\\/g, '/');

    // Đảm bảo có slash đầu.
    value = value.startsWith('/')
      ? value
      : `/${value}`;

    /**
     * Gom:
     * /api/api/api/national-parks
     *
     * thành:
     * /api/national-parks
     */
    value = value.replace(
      /^(?:\/api)+(?=\/|$)/i,
      '/api',
    );

    /**
     * apiUrl đã là:
     * https://domain.com/api
     *
     * nên path không được bắt đầu tiếp bằng /api.
     */
    if (
      this.apiUrl.toLowerCase().endsWith('/api') &&
      /^\/api(?:\/|$)/i.test(value)
    ) {
      value = value.replace(/^\/api(?=\/|$)/i, '');
    }

    // Sau khi bỏ /api có thể thành chuỗi rỗng.
    if (!value) {
      return '';
    }

    return value.startsWith('/')
      ? value
      : `/${value}`;
  }

  private normalizeAbsoluteUrl(url: string): string {
    try {
      const parsedUrl = new URL(
        url.startsWith('//')
          ? `${window.location.protocol}${url}`
          : url,
      );

      /**
       * Sửa đường dẫn:
       * https://domain.com/api/api/national-parks
       *
       * thành:
       * https://domain.com/api/national-parks
       */
      parsedUrl.pathname = parsedUrl.pathname
        .replace(/\/{2,}/g, '/')
        .replace(/^(?:\/api)+(?=\/|$)/i, '/api');

      return parsedUrl.toString();
    } catch {
      // Không làm ứng dụng crash khi dữ liệu URL không hợp lệ.
      return url;
    }
  }

  private isAbsoluteUrl(value: string): boolean {
    return /^(?:https?:)?\/\//i.test(value);
  }
}