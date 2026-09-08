import { Component, inject, signal } from '@angular/core';

import type { RoleDefinition } from '../../../data-access/models/auth/auth.model';
import { DataGovernanceService } from '../../../data-access/services/governance/data-governance.service';
import { AdminNavbarComponent } from '../components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-role-management-page',
  imports: [AdminNavbarComponent],
  templateUrl: './role-management.page.html',
  styleUrl: './role-management.page.css',
})
export class RoleManagementPage {
  private readonly governanceService = inject(DataGovernanceService);

  readonly roles = signal<RoleDefinition[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  constructor() {
    this.loadRoleMatrix();
  }

  loadRoleMatrix() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.governanceService.roleMatrix().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Chưa tải được ma trận phân quyền.');
        this.isLoading.set(false);
      },
    });
  }
}
