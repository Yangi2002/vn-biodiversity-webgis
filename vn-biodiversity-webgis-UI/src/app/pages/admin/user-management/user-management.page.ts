import { Component } from '@angular/core';

import { AdminNavbarComponent } from '../components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-user-management-page',
  imports: [AdminNavbarComponent],
  templateUrl: './user-management.page.html',
  styleUrl: './user-management.page.css',
})
export class UserManagementPage {}
