import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { HttpApiService } from '../../../core/api/http-api.service';
import type { GovernancePermission, GovernanceRole, RolePermissionMatrix } from '../../models/auth/auth.model';

@Injectable({
  providedIn: 'root',
})
export class DataGovernanceService {
  private readonly api = inject(HttpApiService);

  roleMatrix() {
    return this.api.get<RolePermissionMatrix>(API_ENDPOINTS.authPermissionMatrix);
  }

  updateRolePermissions(roleCode: GovernanceRole, permissions: GovernancePermission[]) {
    return this.api.patch<RolePermissionMatrix>(API_ENDPOINTS.authRolePermissions(roleCode), { permissions });
  }
}
