import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { HttpApiService } from '../../../core/api/http-api.service';
import type { GovernanceRole } from '../../models/auth/auth.model';
import type { ManagedUser } from '../../models/user-management.model';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly api = inject(HttpApiService);

  list(search = '') {
    const params = search ? new HttpParams().set('q', search) : undefined;
    return this.api.get<ManagedUser[]>(API_ENDPOINTS.users, params);
  }

  updateStatus(userId: string, isActive: boolean) {
    return this.api.patch<ManagedUser>(API_ENDPOINTS.userStatus(userId), { isActive });
  }

  updateRole(userId: string, role: GovernanceRole) {
    return this.api.put<ManagedUser>(API_ENDPOINTS.userRole(userId), { role });
  }
}
