import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface CredentialLink {
  label: string;
  url: string;
}

@Component({
  selector: 'app-credentials-footer',
  templateUrl: './credentials-footer.component.html',
  styleUrl: './credentials-footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsFooterComponent {
  readonly logoSrc = input.required<string>();
  readonly logoAlt = input.required<string>();
  readonly organizationName = input.required<string>();
  readonly organizationNameEn = input<string>();
  readonly description = input<string>();
  readonly links = input<readonly CredentialLink[]>([]);
}
