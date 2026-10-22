import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AdminAuthService } from '../../../data-access/services/auth/admin-auth.service';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.css',
})
export class SiteHeaderComponent {
  @Input() sectionLabel = 'VN Biodiversity WebGIS';

  protected readonly auth = inject(AdminAuthService);
}
