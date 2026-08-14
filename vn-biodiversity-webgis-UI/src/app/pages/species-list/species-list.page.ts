import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { SpeciesService } from '../../data-access/services/species.service';
import type { SpeciesSearchItem, SpeciesSearchResponse } from '../../data-access/models/species.model';
import { FOOTER_CREDENTIAL_LINKS, VNSC_LOGO_SRC } from '../home/home.data';

interface SearchState {
  q: string;
  page: number;
  sourceTable: string;
  kingdom: string;
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

interface SpeciesTitleLine {
  text: string;
  className: string;
}

@Component({
  selector: 'app-species-list-page',
  imports: [ReactiveFormsModule, RouterLink, CredentialsFooterComponent, PaginationComponent, SiteHeaderComponent],
  templateUrl: './species-list.page.html',
  styleUrl: './species-list.page.css',
})
export class SpeciesListPage {
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly sourceTableControl = new FormControl('', { nonNullable: true });
  protected readonly kingdomControl = new FormControl('', { nonNullable: true });
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
        kingdom: params.get('kingdom') ?? '',
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
      this.kingdomControl.setValue(state.kingdom, { emitEvent: false });
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

  protected applyKingdomFilter(): void {
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
    this.kingdomControl.setValue('');
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

  protected titleDisplayLines(item: SpeciesSearchItem): SpeciesTitleLine[] {
    const parsedLines = this.parseTitleBlockLines(item.titleBlock);

    if (parsedLines.length) {
      return this.normalizeTitleBlockLines(parsedLines, item);
    }

    return this.fallbackTitleLines(item);
  }

  private search(state: SearchState): void {
    const requestId = this.searchRequestId + 1;
    const searchParams = {
      q: state.q,
      page: state.page,
      limit: 24,
      sourceTable: state.sourceTable,
      kingdom: state.kingdom,
      className: state.className,
      order: state.order,
      family: state.family,
      genus: state.genus,
      taxonId: state.taxonId,
    };

    this.searchRequestId = requestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.speciesService
      .search(searchParams)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.searchRequestId) {
            return;
          }

          this.response.set(response);
          this.isLoading.set(false);
          this.prefetchNextPage(searchParams, response);
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

  private prefetchNextPage(searchParams: SearchState & { limit: number }, response: SpeciesSearchResponse): void {
    if (!response.hasNextPage) {
      return;
    }

    this.speciesService.prefetchSearch({
      ...searchParams,
      page: response.page + 1,
    });
  }

  private createStateFromControls(page: number): SearchState {
    return {
      q: this.searchControl.value.trim(),
      page,
      sourceTable: this.sourceTableControl.value,
      kingdom: this.kingdomControl.value,
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

  private parseTitleBlockLines(titleBlock?: string | null): string[] {
    const normalized = titleBlock?.trim();

    if (!normalized) {
      return [];
    }

    return normalized
      .split('\n')
      .flatMap((line) =>
        line
          .replace(/\s+(Họ:)/g, '\n$1')
          .replace(/\s+(Bộ:)/g, '\n$1')
          .replace(/\s+(Tên khoa học khác:)/g, '\n$1')
          .split('\n'),
      )
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private normalizeTitleBlockLines(lines: string[], item: SpeciesSearchItem): SpeciesTitleLine[] {
    const result: SpeciesTitleLine[] = [];
    const firstFreeLine = lines.find((line) => !this.isLabeledTitleLine(line));
    const vietnameseName = item.vietnameseName?.trim();
    const scientificName = item.scientificName?.trim();

    if (vietnameseName) {
      result.push({ text: vietnameseName, className: 'is-vietnamese-name' });
    } else if (firstFreeLine) {
      result.push({ text: firstFreeLine, className: 'is-vietnamese-name' });
    } else if (scientificName) {
      result.push({ text: scientificName, className: 'is-vietnamese-name' });
    }

    const latinLine = lines.find((line) => line !== firstFreeLine && !this.isLabeledTitleLine(line)) ?? scientificName;

    if (latinLine && latinLine !== result[0]?.text) {
      result.push({ text: latinLine, className: 'is-scientific-name' });
    }

    for (const line of lines) {
      if (this.startsWithAny(line, ['Họ:'])) {
        result.push({ text: line, className: 'is-family' });
      } else if (this.startsWithAny(line, ['Bộ:'])) {
        result.push({ text: line, className: 'is-order' });
      } else if (this.startsWithAny(line, ['Tên khoa học khác:'])) {
        result.push({ text: line, className: 'is-scientific-name' });
      }
    }

    return result.length ? result : this.fallbackTitleLines(item);
  }

  private fallbackTitleLines(item: SpeciesSearchItem): SpeciesTitleLine[] {
    const vietnameseName = item.vietnameseName?.trim();
    const scientificName = item.scientificName?.trim();
    const family = item.family?.trim();
    const order = item.order?.trim();
    const className = item.className?.trim();
    const genus = item.genus?.trim();

    if (vietnameseName) {
      return [
        { text: vietnameseName, className: 'is-vietnamese-name' },
        ...(scientificName ? [{ text: scientificName, className: 'is-scientific-name' }] : []),
        ...(family ? [{ text: `Họ: ${family}`, className: 'is-family' }] : []),
        ...(order ? [{ text: `Bộ: ${order}`, className: 'is-order' }] : []),
      ];
    }

    const taxonomyLines = [
      family ? `Họ: ${family}` : '',
      genus ? `Chi: ${genus}` : '',
      scientificName ? `Loài: ${scientificName}` : '',
      order ? `Bộ: ${order}` : '',
      className ? `Lớp / nhóm: ${className}` : '',
    ].filter(Boolean);

    return taxonomyLines.length
      ? taxonomyLines.slice(0, 3).map((text, index) => ({
          text,
          className: index === 0 ? 'is-vietnamese-name' : 'is-extra',
        }))
      : [{ text: 'Thông tin mô tả đang cập nhật', className: 'is-extra' }];
  }

  private isLabeledTitleLine(line: string): boolean {
    return this.startsWithAny(line, [
      'Họ:',
      'Bộ:',
      'Tên khoa học khác:',
    ]);
  }

  private startsWithAny(value: string, prefixes: string[]): boolean {
    return prefixes.some((prefix) => value.startsWith(prefix));
  }
}
