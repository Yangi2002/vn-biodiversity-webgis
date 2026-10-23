import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import type { GovernancePermission } from '../../../data-access/models/auth/auth.model';
import { AdminAuthService } from '../../../data-access/services/auth/admin-auth.service';

export type ManagementWorkspace = 'admin' | 'editor';
export type ManagementTab =
  | 'data'
  | 'change-requests'
  | 'users'
  | 'roles'
  | 'overview'
  | 'import'
  | 'create'
  | 'requests'
  | 'settings';

interface ManagementNavItem {
  icon: string;
  label: string;
  description: string;
  route: string;
  tab: ManagementTab;
  permission?: GovernancePermission;
}

const PUBLIC_NAV_ITEMS = [
  { label: 'Trang chủ', route: '/' },
  { label: 'Danh mục loài', route: '/species-list' },
  { label: 'Phân loại', route: '/taxonomy' },
  { label: 'Bản đồ', route: '/map' },
  { label: 'Thống kê', route: '/statistics' },
  { label: 'Danh sách đỏ', route: '/endangered-species' },
  { label: 'Khu bảo tồn', route: '/nature-reserves' },
] as const;

const ADMIN_NAV_ITEMS: ManagementNavItem[] = [
  { icon: 'DB', label: 'Dữ liệu & đồng bộ', description: 'Cấu hình và đồng bộ dữ liệu', route: '/admin', tab: 'data' },
  { icon: 'RV', label: 'Duyệt & công bố', description: 'Duyệt các thay đổi dữ liệu', route: '/admin/change-requests', tab: 'change-requests' },
  { icon: 'US', label: 'Người dùng', description: 'Khóa, mở khóa và đổi role', route: '/admin/users', tab: 'users' },
  { icon: 'RL', label: 'Vai trò & quyền', description: 'Cấu hình ma trận quyền', route: '/admin/roles', tab: 'roles' },
];

const EDITOR_NAV_ITEMS: ManagementNavItem[] = [
  { icon: 'OV', label: 'Tổng quan', description: 'Không gian làm việc', route: '/editor', tab: 'overview', permission: 'species.view.full' },
  { icon: 'IM', label: 'Nhập Excel / CSV', description: 'Kiểm tra trước khi gửi', route: '/editor/import', tab: 'import', permission: 'data.import' },
  { icon: 'NW', label: 'Thêm dữ liệu', description: 'Tạo đề xuất loài mới', route: '/editor/species/new', tab: 'create', permission: 'species.create' },
  { icon: 'RQ', label: 'Đề xuất của tôi', description: 'Theo dõi trạng thái duyệt', route: '/editor/requests', tab: 'requests', permission: 'species.view.full' },
];

@Component({
  selector: 'app-management-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './management-sidebar.component.html',
  styleUrl: './management-sidebar.component.css',
})
export class ManagementSidebarComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly workspace = input.required<ManagementWorkspace>();
  readonly activeTab = input<ManagementTab>('overview');
  readonly publicNavItems = PUBLIC_NAV_ITEMS;
  readonly navigationLabel = computed(() => this.workspace() === 'admin' ? 'Quản trị' : 'Biên tập dữ liệu');
  readonly brandMark = computed(() => this.workspace() === 'admin' ? 'AD' : 'ED');
  readonly brandLabel = computed(() => this.workspace() === 'admin' ? 'Administration' : 'Editorial workspace');
  readonly navItems = computed(() =>
    (this.workspace() === 'admin' ? ADMIN_NAV_ITEMS : EDITOR_NAV_ITEMS)
      .filter((item) => !item.permission || this.auth.hasPermission([item.permission])),
  );

  get currentUser() {
    return this.auth.currentUser();
  }

  logout() {
    this.auth.logoutFromServer().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => {
        this.auth.logout();
        this.router.navigateByUrl('/login');
      },
    });
  }
}
