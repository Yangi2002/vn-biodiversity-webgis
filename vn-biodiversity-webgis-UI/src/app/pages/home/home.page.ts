import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import { HeroSliderComponent } from '../../shared/components/hero-slider/hero-slider.component';
import {
  FOOTER_CREDENTIAL_LINKS,
  HOME_FEATURE_LINKS,
  HOME_HERO_SLIDES,
  HOME_SOURCE_GROUPS,
  TRUSTED_SOURCES,
  VNSC_LOGO_SRC,
} from './home.data';

@Component({
  selector: 'app-home-page',
  imports: [ReactiveFormsModule, RouterLink, HeroSliderComponent, CredentialsFooterComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly featureLinks = HOME_FEATURE_LINKS;
  protected readonly heroSlides = HOME_HERO_SLIDES;
  protected readonly sourceGroups = HOME_SOURCE_GROUPS;
  protected readonly trustedSources = TRUSTED_SOURCES;
  protected readonly footerLinks = FOOTER_CREDENTIAL_LINKS;
  protected readonly vnscLogoSrc = VNSC_LOGO_SRC;

  constructor(private readonly router: Router) {}

  protected submitSearch(event?: Event): void {
    event?.preventDefault();

    const query = this.searchControl.value.trim();

    void this.router.navigate(['/species-list'], {
      queryParams: query ? { q: query } : undefined,
    });
  }
}
