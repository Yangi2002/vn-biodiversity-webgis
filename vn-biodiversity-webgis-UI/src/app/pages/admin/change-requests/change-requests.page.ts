import { Component } from '@angular/core';

import { ManagementSidebarComponent } from '../../../shared/components/management-sidebar/management-sidebar.component';

@Component({
  selector: 'app-change-requests-page',
  imports: [ManagementSidebarComponent],
  templateUrl: './change-requests.page.html',
  styleUrl: './change-requests.page.css',
})
export class ChangeRequestsPage {}
