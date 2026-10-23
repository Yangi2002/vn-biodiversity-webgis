import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import type { GovernanceRole } from '../../../data-access/models/auth/auth.model';
import type { ManagedUser } from '../../../data-access/models/user-management.model';
import { UserManagementService } from '../../../data-access/services/governance/user-management.service';
import { ManagementSidebarComponent } from '../../../shared/components/management-sidebar/management-sidebar.component';

const ASSIGNABLE_ROLES: { code: GovernanceRole; label: string }[] = [
  { code: 'editor-staff', label: 'Editor Staff' },
  { code: 'registered-user', label: 'Registered User' },
];

@Component({
  selector: 'app-user-management-page',
  imports: [ManagementSidebarComponent, DatePipe],
  templateUrl: './user-management.page.html',
  styleUrl: './user-management.page.css',
})
export class UserManagementPage {
  private readonly service = inject(UserManagementService);

  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly roleOptions = ASSIGNABLE_ROLES;
  protected readonly drafts = signal<Record<string, GovernanceRole>>({});
  protected readonly isLoading = signal(true);
  protected readonly pendingUserId = signal('');
  protected readonly errorMessage = signal('');
  protected search = '';

  constructor() {
    this.load();
  }

  protected load() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.service.list(this.search.trim()).subscribe({
      next: (users) => {
        this.users.set(users);
        this.drafts.set(Object.fromEntries(users.map((user) => [user.userId, this.accountRole(user)])));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Chưa tải được danh sách tài khoản.');
        this.isLoading.set(false);
      },
    });
  }

  protected updateSearch(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
  }

  protected updateRoleDraft(userId: string, event: Event) {
    const role = (event.target as HTMLSelectElement).value as GovernanceRole;
    this.drafts.update((drafts) => ({ ...drafts, [userId]: role }));
  }

  protected saveRole(user: ManagedUser) {
    this.runAction(user.userId, this.service.updateRole(user.userId, this.drafts()[user.userId]));
  }

  protected toggleStatus(user: ManagedUser) {
    this.runAction(user.userId, this.service.updateStatus(user.userId, !user.isActive));
  }

  protected isSystemAdministrator(user: ManagedUser) {
    return user.roles.includes('administrator');
  }

  private runAction(userId: string, request: ReturnType<UserManagementService['updateStatus']>) {
    this.pendingUserId.set(userId);
    this.errorMessage.set('');
    request.subscribe({
      next: (updatedUser) => {
        if (!updatedUser) {
          this.pendingUserId.set('');
          return;
        }
        this.users.update((users) => users.map((user) => user.userId === userId ? updatedUser : user));
        this.drafts.update((drafts) => ({ ...drafts, [userId]: this.accountRole(updatedUser) }));
        this.pendingUserId.set('');
      },
      error: (error) => {
        this.pendingUserId.set('');
        this.errorMessage.set(error.error?.message ?? 'Không thể cập nhật tài khoản.');
      },
    });
  }

  private accountRole(user: ManagedUser): GovernanceRole {
    return user.roles.find((role) => role !== 'anonymous') ?? 'registered-user';
  }
}
