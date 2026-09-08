import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { HttpApiService } from '../../../core/api/http-api.service';
import type { RoleDefinition } from '../../models/auth/auth.model';

@Injectable({
  providedIn: 'root',
})
export class DataGovernanceService {
  private readonly api = inject(HttpApiService);

  roleMatrix() {
    return this.api.get<RoleDefinition[]>(API_ENDPOINTS.authPermissionMatrix);
  }
}
