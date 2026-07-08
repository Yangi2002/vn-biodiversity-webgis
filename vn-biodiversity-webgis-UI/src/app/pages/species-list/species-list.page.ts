import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SpeciesService } from '../../data-access/services/species.service';
import type { SpeciesSearchItem, SpeciesSearchResponse } from '../../data-access/models/species.model';
import { FOOTER_CREDENTIAL_LINKS, VNSC_LOGO_SRC } from '../home/home.data';

interface SearchState {
  q: string;
  page: number;
  sourceTable: string;
  className: string;
  order: string;
  family: string;
  genus: string;
  taxonId: string;
}

interface SpeciesListNavigationState {
  speciesListState?: SearchState;
}

interface SpeciesSearchTag {
  label: string;
  query: string;
}

@Component({
  selector: 'app-species-list-page',
  imports: [ReactiveFormsModule, RouterLink, CredentialsFooterComponent, SiteHeaderComponent],
  templateUrl: './species-list.page.html',
  styleUrl: './species-list.page.css',
})
export class SpeciesListPage {
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly sourceTableControl = new FormControl('', { nonNullable: true });
  protected readonly classNameControl = new FormControl('', { nonNullable: true });
  protected readonly orderControl = new FormControl('', { nonNullable: true });
  protected readonly familyControl = new FormControl('', { nonNullable: true });
  protected readonly genusControl = new FormControl('', { nonNullable: true });
  protected readonly response = signal<SpeciesSearchResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly footerLinks = FOOTER_CREDENTIAL_LINKS;
  protected readonly vnscLogoSrc = VNSC_LOGO_SRC;
  protected readonly searchTags: SpeciesSearchTag[] = [
    { label: 'Rùa', query: 'rùa' },
    { label: 'Lan', query: 'lan' },
    { label: 'Bướm', query: 'bướm' },
    { label: 'Ếch', query: 'ếch' },
    { label: 'Magnolia', query: 'Magnolia' },
  ];

  private readonly speciesService = inject(SpeciesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private searchRequestId = 0;
  private restoredState = this.readRestoredState();
  private activeTaxonId = '';

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state: SearchState = this.restoredState ?? {
        q: params.get('q') ?? '',
        page: this.parsePage(params.get('page')),
        sourceTable: params.get('sourceTable') ?? '',
        className: params.get('className') ?? '',
        order: params.get('order') ?? '',
        family: params.get('family') ?? '',
        genus: params.get('genus') ?? '',
        taxonId: params.get('taxonId') ?? '',
      };
      this.restoredState = null;
      this.activeTaxonId = state.taxonId;

      this.searchControl.setValue(state.q, { emitEvent: false });
      this.sourceTableControl.setValue(state.sourceTable, { emitEvent: false });
      this.classNameControl.setValue(state.className, { emitEvent: false });
      this.orderControl.setValue(state.order, { emitEvent: false });
      this.familyControl.setValue(state.family, { emitEvent: false });
      this.genusControl.setValue(state.genus, { emitEvent: false });
      this.search(state);
    });
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();
    this.search(this.createStateFromControls(1));
  }

  protected clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.search(this.createStateFromControls(1));
  }

  protected applySearchTag(tag: SpeciesSearchTag): void {
    this.activeTaxonId = '';
    this.searchControl.setValue(tag.query, { emitEvent: false });
    this.search(this.createStateFromControls(1));
  }

  protected applyFilters(): void {
    this.search(this.createStateFromControls(1));
  }

  protected applySourceTableFilter(): void {
    this.activeTaxonId = '';
    this.classNameControl.setValue('', { emitEvent: false });
    this.orderControl.setValue('', { emitEvent: false });
    this.familyControl.setValue('', { emitEvent: false });
    this.genusControl.setValue('', { emitEvent: false });
    this.applyFilters();
  }

  protected applyClassFilter(): void {
    this.activeTaxonId = '';
    this.orderControl.setValue('', { emitEvent: false });
    this.familyControl.setValue('', { emitEvent: false });
    this.genusControl.setValue('', { emitEvent: false });
    this.applyFilters();
  }

  protected applyOrderFilter(): void {
    this.activeTaxonId = '';
    this.familyControl.setValue('', { emitEvent: false });
    this.genusControl.setValue('', { emitEvent: false });
    this.applyFilters();
  }

  protected applyFamilyFilter(): void {
    this.activeTaxonId = '';
    this.genusControl.setValue('', { emitEvent: false });
    this.applyFilters();
  }

  protected clearFilters(): void {
    this.activeTaxonId = '';
    this.sourceTableControl.setValue('');
    this.classNameControl.setValue('');
    this.orderControl.setValue('');
    this.familyControl.setValue('');
    this.genusControl.setValue('');
    this.applyFilters();
  }

  protected goToPage(page: number): void {
    const data = this.response();

    if (!data || page < 1 || page > data.totalPages || page === data.page) {
      return;
    }

    this.search(this.createStateFromControls(page));
  }

  protected pageNumbers(data: SpeciesSearchResponse): number[] {
    const start = Math.max(1, data.page - 2);
    const end = Math.min(data.totalPages, data.page + 2);
    const pages: number[] = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  protected imageAlt(item: SpeciesSearchItem): string {
    return item.vietnameseName ?? item.scientificName ?? 'Ảnh loài';
  }

  protected hideBrokenImage(event: Event): void {
    const image = event.target;

    if (image instanceof HTMLImageElement) {
      image.hidden = true;
    }
  }

  protected detailRouteState() {
    return { speciesListState: this.createStateFromControls(this.response()?.page ?? 1) };
  }

  protected titleBlockLines(item: SpeciesSearchItem): string[] {
    const titleBlock = item.titleBlock?.trim();

    if (!titleBlock) {
      return ['Thông tin mô tả đang cập nhật'];
    }

    return titleBlock.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  protected titleLineClass(line: string, index: number): string {
    if (index === 0) {
      return 'is-vietnamese-name';
    }

    if (index === 1) {
      return 'is-scientific-name';
    }

    if (line.startsWith('Họ:')) {
      return 'is-family';
    }

    if (line.startsWith('Bộ:')) {
      return 'is-order';
    }

    return 'is-extra';
  }

  private search(state: SearchState): void {
    const requestId = this.searchRequestId + 1;
    this.searchRequestId = requestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.speciesService
      .search({
        q: state.q,
        page: state.page,
        limit: 24,
        sourceTable: state.sourceTable,
        className: state.className,
        order: state.order,
        family: state.family,
        genus: state.genus,
        taxonId: state.taxonId,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.searchRequestId) {
            return;
          }

          this.response.set(response);
          this.isLoading.set(false);
        },
        error: () => {
          if (requestId !== this.searchRequestId) {
            return;
          }

          this.errorMessage.set('Không tải được dữ liệu loài từ máy chủ.');
          this.response.set(null);
          this.isLoading.set(false);
        },
      });
  }

  private createStateFromControls(page: number): SearchState {
    return {
      q: this.searchControl.value.trim(),
      page,
      sourceTable: this.sourceTableControl.value,
      className: this.classNameControl.value,
      order: this.orderControl.value,
      family: this.familyControl.value,
      genus: this.genusControl.value,
      taxonId: this.activeTaxonId,
    };
  }

  private parsePage(value: string | null): number {
    const page = Number(value);

    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  private readRestoredState(): SearchState | null {
    const state = this.router.getCurrentNavigation()?.extras.state as SpeciesListNavigationState | undefined;

    return state?.speciesListState ?? null;
  }
}
