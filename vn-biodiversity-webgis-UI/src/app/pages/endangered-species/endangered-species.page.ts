import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import type { ConservationCategoryOption, ConservationSpeciesItem, ConservationSpeciesResponse } from '../../data-access/models/conservation.model';
import { ConservationService } from '../../data-access/services/conservation.service';
import { DashboardMetricStripComponent, type DashboardMetricItem } from '../../shared/components/dashboard-metric-strip/dashboard-metric-strip.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';

@Component({
  selector: 'app-endangered-species-page',
  imports: [DecimalPipe, RouterLink, SiteHeaderComponent, DashboardMetricStripComponent, PaginationComponent],
  templateUrl: './endangered-species.page.html',
  styleUrl: './endangered-species.page.css',
})
export class EndangeredSpeciesPage {
  protected readonly data = signal<ConservationSpeciesResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly queryDraft = signal('');
  protected readonly categoryDraft = signal('');
  protected readonly sourceTableDraft = signal('');
  protected readonly observationTermDraft = signal('');
  protected readonly page = signal(1);
  protected readonly limit = 24;

  protected readonly sourceOptions = [
    { value: 'animal_db_vn', label: 'Động vật' },
    { value: 'plant_db_vn', label: 'Thực vật' },
    { value: 'insect_db_vn', label: 'Côn trùng' },
  ];

  protected readonly metricItems = computed<DashboardMetricItem[]>(() => {
    const summary = this.data()?.summary;
    const topRisk = summary?.categories[0];
    const secondRisk = summary?.categories[1];

    return [
      {
        label: 'Loài có hồ sơ',
        value: summary?.totalMatchedSpecies ?? 0,
        helper: 'Đã match với dữ liệu loài',
      },
      {
        label: 'Hồ sơ VN Red List',
        value: summary?.totalProfiles ?? 0,
        helper: 'Trang nguồn đã cào',
      },
      {
        label: topRisk ? topRisk.category : 'Mức nguy cơ',
        value: topRisk?.total ?? 0,
        helper: topRisk ? this.riskLabel(topRisk.category) : 'Theo VN Red List',
        accent: 'warning',
      },
      {
        label: secondRisk ? secondRisk.category : 'Nhóm tiếp theo',
        value: secondRisk?.total ?? 0,
        helper: secondRisk ? this.riskLabel(secondRisk.category) : 'Theo VN Red List',
        accent: 'plant',
      },
    ];
  });

  private readonly conservationService = inject(ConservationService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.load();
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.queryDraft.set('');
    this.categoryDraft.set('');
    this.sourceTableDraft.set('');
    this.observationTermDraft.set('');
    this.page.set(1);
    this.load();
  }

  protected goToPage(page: number): void {
    const totalPages = this.data()?.totalPages ?? 1;
    this.page.set(Math.min(Math.max(page, 1), totalPages));
    this.load();
  }

  protected updateQuery(value: string): void {
    this.queryDraft.set(value);
  }

  protected updateCategory(value: string): void {
    this.categoryDraft.set(value);
  }

  protected updateSourceTable(value: string): void {
    this.sourceTableDraft.set(value);
  }

  protected updateObservationTerm(value: string): void {
    this.observationTermDraft.set(value);
  }

  protected displayName(item: ConservationSpeciesItem): string {
    return item.vietnameseName || item.scientificName || item.speciesId;
  }

  protected categoryClass(category: string | null): string {
    return `risk-${(category || 'unknown').toLowerCase()}`;
  }

  protected categoryOptions(): ConservationCategoryOption[] {
    return this.data()?.categoryOptions ?? [];
  }

  protected riskLabel(category: string | null): string {
    if (!category) {
      return 'Chưa rõ';
    }

    return this.categoryOptions().find((option) => option.category === category)?.label ?? category;
  }

  protected publishedYear(item: ConservationSpeciesItem): string {
    return item.publishedYear?.trim() || 'Chưa có dữ liệu';
  }

  protected evaluatorName(item: ConservationSpeciesItem): string {
    return this.compactNameList(item.assessor);
  }

  protected evaluatorTitle(item: ConservationSpeciesItem): string {
    return item.assessor?.trim() || 'Không công khai';
  }

  private compactNameList(value: string | null): string {
    const text = value?.trim();

    if (!text) {
      return 'Không công khai';
    }

    const [firstName, ...others] = text.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);

    if (!firstName) {
      return 'Không công khai';
    }

    return others.length ? `${firstName}, ...` : firstName;
  }

  private load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.conservationService
      .endangeredSpecies({
        q: this.queryDraft(),
        category: this.categoryDraft(),
        sourceTable: this.sourceTableDraft(),
        observationTermId: this.observationTermDraft(),
        page: this.page(),
        limit: this.limit,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.data.set(response);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Không tải được dữ liệu danh sách đỏ Việt Nam.');
          this.isLoading.set(false);
        },
      });
  }
}
