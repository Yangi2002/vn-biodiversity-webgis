import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AdminAuthService } from '../../../../data-access/services/auth/admin-auth.service';

export type AdminTab = 'data' | 'change-requests' | 'users' | 'roles' | 'settings';

interface AdminNavItem {
  icon: string;
  label: string;
  tab: AdminTab;
  description: string;
}

interface PublicNavItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css',
})
export class AdminNavbarComponent {
  private readonly authService = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly activeTab = input<AdminTab>('data');
  readonly tabChange = output<AdminTab>();

  readonly publicNavItems: PublicNavItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Danh mục loài', route: '/species-list' },
    { label: 'Phân loại', route: '/taxonomy' },
    { label: 'Bản đồ', route: '/map' },
    { label: 'Thống kê', route: '/statistics' },
    { label: 'Danh sách đỏ', route: '/endangered-species' },
    { label: 'Khu bảo tồn', route: '/nature-reserves' },
  ];

  readonly navItems: AdminNavItem[] = [
    {
      icon: 'DB',
      label: 'Dữ liệu & đồng bộ',
      tab: 'data',
      description: 'Cấu hình và đồng bộ dữ liệu',
    },
    {
      icon: 'RV',
      label: 'Duyệt & công bố',
      tab: 'change-requests',
      description: 'Duyệt các thay đổi dữ liệu',
    },
    {
      icon: 'US',
      label: 'Người dùng',
      tab: 'users',
      description: 'Khóa, mở khóa và đổi role',
    },
    {
      icon: 'RL',
      label: 'Vai trò & quyền',
      tab: 'roles',
      description: 'Cấu hình ma trận quyền',
    },
  ];

  get currentUser() {
    return this.authService.currentUser();
  }

  selectTab(tab: AdminTab) {
    this.tabChange.emit(tab);
    const routes: Record<AdminTab, string> = {
      data: '/admin',
      'change-requests': '/admin/change-requests',
      users: '/admin/users',
      roles: '/admin/roles',
      settings: '/account',
    };
    this.router.navigateByUrl(routes[tab]);
  }

  logout() {
    this.authService.logoutFromServer().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => {
        this.authService.logout();
        this.router.navigateByUrl('/login');
      },
    });
  }
}
