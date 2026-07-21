import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';

import { AdminAuthService } from '../../../../data-access/services/auth/admin-auth.service';

export type AdminTab = 'data' | 'change-requests' | 'users' | 'roles';

interface AdminNavItem {
  icon: string;
  label: string;
  tab: AdminTab;
  description: string;
}

@Component({
  selector: 'app-admin-navbar',
  imports: [],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css',
})
export class AdminNavbarComponent {
  private readonly authService = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser();
  readonly activeTab = input<AdminTab>('data');
  readonly tabChange = output<AdminTab>();

  readonly navItems: AdminNavItem[] = [
    {
      icon: 'DB',
      label: 'Dữ liệu chính',
      tab: 'data',
      description: 'Animal, plant, insect',
    },
    {
      icon: 'RV',
      label: 'Yêu cầu duyệt',
      tab: 'change-requests',
      description: 'Pending review',
    },
    {
      icon: 'US',
      label: 'Người dùng',
      tab: 'users',
      description: 'Tài khoản hệ thống',
    },
    {
      icon: 'RL',
      label: 'Vai trò',
      tab: 'roles',
      description: 'Phân quyền dữ liệu',
    },
  ];

  logout() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
