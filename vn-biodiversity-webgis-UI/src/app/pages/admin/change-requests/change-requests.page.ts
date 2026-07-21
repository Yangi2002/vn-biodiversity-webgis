import { Component } from '@angular/core';

import { AdminNavbarComponent } from '../components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-change-requests-page',
  imports: [AdminNavbarComponent],
  templateUrl: './change-requests.page.html',
  styleUrl: './change-requests.page.css',
})
export class ChangeRequestsPage {}
