import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { HttpApiService } from '../../../core/api/http-api.service';
import type { AdminUser, LoginResponse } from '../../models/auth/auth.model';

const AUTH_TOKEN_KEY = 'vn_biodiversity_admin_token';
const AUTH_USER_KEY = 'vn_biodiversity_admin_user';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthService {
  private readonly api = inject(HttpApiService);
  private readonly platformId = inject(PLATFORM_ID);

  login(email: string, password: string) {
    return this.api.post<LoginResponse>(API_ENDPOINTS.authLogin, { email, password }).pipe(
      tap((response) => {
        this.storeSession(response.accessToken, response.user);
      }),
    );
  }

  logout() {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  token() {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  currentUser() {
    if (!this.isBrowser()) {
      return null;
    }

    const value = localStorage.getItem(AUTH_USER_KEY);

    return value ? (JSON.parse(value) as AdminUser) : null;
  }

  isAuthenticated() {
    return Boolean(this.token());
  }

  private storeSession(token: string, user: AdminUser) {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  private isBrowser() {
    return isPlatformBrowser(this.platformId);
  }
}
