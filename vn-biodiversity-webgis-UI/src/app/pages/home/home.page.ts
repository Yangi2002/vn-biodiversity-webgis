import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import type { ConservationSpeciesResponse } from '../../data-access/models/conservation.model';
import type { SpeciesSearchResponse } from '../../data-access/models/species.model';
import type { StatsSummary } from '../../data-access/models/stats.model';
import { ConservationService } from '../../data-access/services/conservation.service';
import { SpeciesService } from '../../data-access/services/species.service';
import { StatsService } from '../../data-access/services/stats.service';
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

interface HomeDataHighlight {
  label: string;
  value: number | null;
  helper: string;
  route: string;
}

@Component({
  selector: 'app-home-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, HeroSliderComponent, CredentialsFooterComponent],
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
  protected readonly statsSummary = signal<StatsSummary | null>(null);
  protected readonly conservation = signal<ConservationSpeciesResponse | null>(null);
  protected readonly speciesCatalog = signal<SpeciesSearchResponse | null>(null);
  protected readonly dataHighlights = computed<readonly HomeDataHighlight[]>(() => {
    const statsSummary = this.statsSummary();
    const conservation = this.conservation();
    const speciesCatalog = this.speciesCatalog();

    return [
      {
        label: 'Loài trong hệ thống',
        value: speciesCatalog?.total ?? 0,
        helper: 'Động vật, thực vật và côn trùng',
        route: '/species-list',
      },
      {
        label: 'Occurrence records',
        value: statsSummary?.totalOccurrences ?? null,
        helper: 'Ghi nhận có tọa độ hợp lệ',
        route: '/map',
      },
      {
        label: 'Vùng ghi nhận',
        value: statsSummary?.totalRegions ?? null,
        helper: 'Tỉnh/vùng có dữ liệu phân bố',
        route: '/statistics',
      },
      {
        label: 'Danh sách đỏ',
        value: conservation?.summary.totalMatchedSpecies ?? 0,
        helper: 'Loài có hồ sơ VN Red List',
        route: '/endangered-species',
      },
    ];
  });
  protected readonly observedYearRange = computed(() => {
    const summary = this.statsSummary();

    if (!summary?.earliestObservedYear || !summary.latestObservedYear) {
      return 'Đang cập nhật';
    }

    return `${summary.earliestObservedYear}-${summary.latestObservedYear}`;
  });

  private readonly statsService = inject(StatsService);
  private readonly conservationService = inject(ConservationService);
  private readonly speciesService = inject(SpeciesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  constructor(private readonly router: Router) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadHomeData();
    }
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();

    const query = this.searchControl.value.trim();

    void this.router.navigate(['/species-list'], {
      queryParams: query ? { q: query } : undefined,
    });
  }

  private loadHomeData(): void {
    this.statsService
      .getSummary()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((statsSummary) => this.statsSummary.set(statsSummary));

    this.conservationService
      .endangeredSpecies({ limit: 1 })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((conservation) => this.conservation.set(conservation));

    this.speciesService
      .search({ limit: 1 })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((speciesCatalog) => this.speciesCatalog.set(speciesCatalog));
  }
}
