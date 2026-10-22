import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { finalize, type Observable, shareReplay, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { HttpApiService } from '../../../core/api/http-api.service';
import type {
  AdminUser,
  AuthResponse,
  GovernancePermission,
  GovernanceRole,
  RegisterRequest,
  RolePermissionMatrix,
  UpdateProfileRequest,
} from '../../models/auth/auth.model';

const AUTH_TOKEN_KEY = 'vn_biodiversity_admin_token';
const AUTH_REFRESH_TOKEN_KEY = 'vn_biodiversity_refresh_token';
const AUTH_USER_KEY = 'vn_biodiversity_admin_user';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthService {
  private readonly api = inject(HttpApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private refreshRequest: Observable<AuthResponse> | null = null;

  login(email: string, password: string) {
    return this.api.post<AuthResponse>(API_ENDPOINTS.authLogin, { email, password }).pipe(
      tap((response) => {
        this.storeSession(response);
      }),
    );
  }

  register(request: RegisterRequest) {
    return this.api.post<AuthResponse>(API_ENDPOINTS.authRegister, request).pipe(
      tap((response) => this.storeSession(response)),
    );
  }

  refreshSession() {
    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    const refreshToken = this.refreshToken();

    this.refreshRequest = this.api.post<AuthResponse>(API_ENDPOINTS.authRefresh, { refreshToken }).pipe(
      tap((response) => this.storeSession(response)),
      finalize(() => (this.refreshRequest = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshRequest;
  }

  logout() {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  logoutFromServer() {
    return this.api.post<{ success: boolean }>(API_ENDPOINTS.authLogout, {}).pipe(
      tap(() => {
        this.logout();
      }),
    );
  }

  me() {
    return this.api.get<AdminUser>(API_ENDPOINTS.authMe).pipe(
      tap((user) => {
        const token = this.token();

        if (token) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
      }),
    );
  }

  updateProfile(request: UpdateProfileRequest) {
    return this.api.put<AdminUser>(API_ENDPOINTS.authProfile, request).pipe(
      tap((user) => {
        if (this.isBrowser()) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
      }),
    );
  }

  permissionMatrix() {
    return this.api.get<RolePermissionMatrix>(API_ENDPOINTS.authPermissionMatrix);
  }

  token() {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  refreshToken() {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
  }

  currentUser() {
    if (!this.isBrowser()) {
      return null;
    }

    const value = localStorage.getItem(AUTH_USER_KEY);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as AdminUser;
    } catch {
      this.logout();
      return null;
    }
  }

  isAuthenticated() {
    return Boolean(this.token());
  }

  hasRole(requiredRoles: readonly GovernanceRole[]) {
    const user = this.currentUser();
    const roles = new Set<GovernanceRole>(user?.roles ?? []);

    return requiredRoles.some((role) => roles.has(role));
  }

  hasPermission(requiredPermissions: readonly GovernancePermission[]) {
    const permissions = new Set(this.currentUser()?.permissions ?? []);

    return requiredPermissions.every((permission) => permissions.has(permission));
  }

  private storeSession(response: AuthResponse) {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(AUTH_TOKEN_KEY, response.accessToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
  }

  private isBrowser() {
    return isPlatformBrowser(this.platformId);
  }
}
