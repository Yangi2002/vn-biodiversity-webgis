import { Component, computed, inject, signal } from '@angular/core';

import type {
  GovernancePermission,
  PermissionDefinition,
  RoleDefinition,
} from '../../../data-access/models/auth/auth.model';
import { DataGovernanceService } from '../../../data-access/services/governance/data-governance.service';
import { ManagementSidebarComponent } from '../../../shared/components/management-sidebar/management-sidebar.component';

@Component({
  selector: 'app-role-management-page',
  imports: [ManagementSidebarComponent],
  templateUrl: './role-management.page.html',
  styleUrl: './role-management.page.css',
})
export class RoleManagementPage {
  private readonly governanceService = inject(DataGovernanceService);

  readonly roles = signal<RoleDefinition[]>([]);
  readonly permissions = signal<PermissionDefinition[]>([]);
  readonly permissionDrafts = signal<Record<string, GovernancePermission[]>>({});
  readonly editableRoles = computed(() => this.roles().filter((role) => role.code !== 'administrator'));
  readonly isLoading = signal(true);
  readonly pendingRole = signal('');
  readonly errorMessage = signal('');

  constructor() {
    this.loadRoleMatrix();
  }

  loadRoleMatrix() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.governanceService.roleMatrix().subscribe({
      next: (matrix) => {
        this.roles.set(matrix.roles);
        this.permissions.set(matrix.permissions);
        this.permissionDrafts.set(
          Object.fromEntries(matrix.roles.map((role) => [role.code, [...role.permissions]])),
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Chưa tải được ma trận phân quyền.');
        this.isLoading.set(false);
      },
    });
  }

  hasPermission(role: RoleDefinition, permission: GovernancePermission) {
    return this.permissionDrafts()[role.code]?.includes(permission) ?? false;
  }

  togglePermission(role: RoleDefinition, permission: GovernancePermission, checked: boolean) {
    const current = new Set(this.permissionDrafts()[role.code] ?? []);
    checked ? current.add(permission) : current.delete(permission);
    this.permissionDrafts.update((drafts) => ({ ...drafts, [role.code]: Array.from(current) }));
  }

  saveRolePermissions(role: RoleDefinition) {
    this.pendingRole.set(role.code);
    this.errorMessage.set('');
    this.governanceService.updateRolePermissions(role.code, this.permissionDrafts()[role.code] ?? []).subscribe({
      next: (matrix) => {
        this.roles.set(matrix.roles);
        this.permissions.set(matrix.permissions);
        this.permissionDrafts.set(
          Object.fromEntries(matrix.roles.map((item) => [item.code, [...item.permissions]])),
        );
        this.pendingRole.set('');
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message ?? 'Không thể cập nhật quyền của vai trò.');
        this.pendingRole.set('');
      },
    });
  }

  permissionGroupLabel(group: string) {
    const labels: Record<string, string> = {
      system: 'Hệ thống',
      identity: 'Tài khoản và phân quyền',
      data: 'Dữ liệu',
      species: 'Hồ sơ loài',
      governance: 'Kiểm duyệt',
    };

    return labels[group] ?? group;
  }
}
