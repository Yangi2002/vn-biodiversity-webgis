import { Component } from '@angular/core';

import { AdminNavbarComponent } from '../components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-role-management-page',
  imports: [AdminNavbarComponent],
  templateUrl: './role-management.page.html',
  styleUrl: './role-management.page.css',
})
export class RoleManagementPage {}
