import { Routes } from '@angular/router';
import { ChangeRequestsPage } from './change-requests/change-requests.page';
import { DataGovernancePage } from './data-governance/data-governance.page';
import { RoleManagementPage } from './role-management/role-management.page';
import { UserManagementPage } from './user-management/user-management.page';

export const adminRoutes: Routes = [
  {
    path: '',
    component: DataGovernancePage,
  },
  {
    path: 'change-requests',
    component: ChangeRequestsPage,
  },
  {
    path: 'users',
    component: UserManagementPage,
  },
  {
    path: 'roles',
    component: RoleManagementPage,
  },
];
