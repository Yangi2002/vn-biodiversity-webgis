import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type {
  SpeciesDetailField,
  SpeciesDetailImage,
  SpeciesDetailResponse,
  SpeciesKeywordReference,
  SpeciesTaxonomyNode,
} from '../../data-access/models/species.model';
import { SpeciesService } from '../../data-access/services/species.service';
import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import { KeywordReferencePanelComponent } from '../../shared/components/keyword-reference-panel/keyword-reference-panel.component';
import { KeywordRichTextComponent } from '../../shared/components/keyword-rich-text/keyword-rich-text.component';
import { SpeciesImageCarouselComponent } from './species-image-carousel/species-image-carousel.component';
import { FOOTER_CREDENTIAL_LINKS, VNSC_LOGO_SRC } from '../home/home.data';

interface SpeciesDetailNavigationState {
  speciesListState?: unknown;
}

@Component({
  selector: 'app-species-detail-page',
  imports: [
    RouterLink,
    CredentialsFooterComponent,
    SpeciesImageCarouselComponent,
    KeywordReferencePanelComponent,
    KeywordRichTextComponent,
  ],
  templateUrl: './species-detail.page.html',
  styleUrl: './species-detail.page.css',
})
export class SpeciesDetailPage {
  protected readonly detail = signal<SpeciesDetailResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly footerLinks = FOOTER_CREDENTIAL_LINKS;
  protected readonly vnscLogoSrc = VNSC_LOGO_SRC;
  protected readonly selectedKeywordId = signal<string | null>(null);
  protected readonly isKeywordPanelOpen = signal(false);

  private readonly speciesService = inject(SpeciesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly speciesListState = signal<unknown | null>(null);
  private readonly contentFieldKeys = [
    'dac_diem_nhan_dang',
    'sinh_hoc_sinh_thai',
    'phan_bo',
    'phan_hang',
    'gia_tri',
    'tinh_trang',
    'bien_phap_bao_ve',
    'cong_dung',
    'mo_ta',
    'mo_ta_loai',
    'tai_lieu_dan',
  ];

  constructor() {
    const navigationState = this.router.getCurrentNavigation()?.extras.state as SpeciesDetailNavigationState | undefined;

    if (navigationState?.speciesListState) {
      this.speciesListState.set(navigationState.speciesListState);
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const sourceTable = params.get('sourceTable');
      const speciesId = params.get('speciesId');

      if (!sourceTable || !speciesId) {
        this.errorMessage.set('Thiếu định danh loài.');
        this.isLoading.set(false);
        return;
      }

      this.loadDetail(sourceTable, speciesId);
    });
  }

  protected displayName(detail: SpeciesDetailResponse): string {
    return detail.vietnameseName || detail.scientificName || detail.speciesId;
  }

  protected titleBlockLines(detail: SpeciesDetailResponse): string[] {
    return (detail.titleBlock ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  }

  protected carouselImages(detail: SpeciesDetailResponse): SpeciesDetailImage[] {
    if (detail.images.length) {
      return detail.images;
    }

    if (!detail.imageUrl) {
      return [];
    }

    return [
      {
        imageOrder: 1,
        imageUrl: detail.imageUrl,
        mimeType: detail.imageMimeType ?? 'image/jpeg',
        width: null,
        height: null,
        sizeBytes: 0,
      },
    ];
  }

  protected contentFields(detail: SpeciesDetailResponse): SpeciesDetailField[] {
    return this.contentFieldKeys
      .map((key) => detail.fields.find((field) => field.key === key))
      .filter((field): field is SpeciesDetailField => Boolean(field && this.hasValue(field)));
  }

  protected extraFields(detail: SpeciesDetailResponse): SpeciesDetailField[] {
    return detail.fields.filter((field) => !this.contentFieldKeys.includes(field.key));
  }

  protected hasValue(field: SpeciesDetailField): boolean {
    return Boolean(field.value?.trim());
  }

  protected taxonomyPath(detail: SpeciesDetailResponse): SpeciesTaxonomyNode[] {
    return detail.taxonomyPath ?? [];
  }

  protected keywordReferences(detail: SpeciesDetailResponse): SpeciesKeywordReference[] {
    return detail.keywords ?? [];
  }

  protected selectKeyword(keyword: SpeciesKeywordReference): void {
    this.selectedKeywordId.set(keyword.keywordId);
    this.isKeywordPanelOpen.set(true);

    if (this.isBrowser) {
      setTimeout(() => document.getElementById('keyword-reference-panel')?.scrollIntoView({ block: 'nearest' }));
    }
  }

  protected setKeywordPanelOpen(isOpen: boolean): void {
    this.isKeywordPanelOpen.set(isOpen);
  }

  protected taxonomyDisplayName(node: SpeciesTaxonomyNode): string {
    return node.vietnameseName || node.canonicalName;
  }

  protected taxonomyRankLabel(rank: string): string {
    const rankLabels: Record<string, string> = {
      source_group: 'Nhom',
      kingdom: 'Gioi',
      phylum: 'Nganh',
      class: 'Lop',
      order: 'Bo',
      family: 'Ho',
      genus: 'Chi',
      species: 'Loai',
    };

    return rankLabels[rank] ?? rank;
  }

  protected goBackToList(): void {
    const speciesListState = this.speciesListState();

    if (speciesListState) {
      void this.router.navigate(['/species-list'], {
        state: { speciesListState },
      });
      return;
    }

    void this.router.navigate(['/species-list']);
  }

  private loadDetail(sourceTable: string, speciesId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.speciesService
      .getDetail(sourceTable, speciesId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.selectedKeywordId.set(detail.keywords?.[0]?.keywordId ?? null);
          this.isKeywordPanelOpen.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.detail.set(null);
          this.errorMessage.set('Không tải được chi tiết loài từ máy chủ.');
          this.isLoading.set(false);
        },
      });
  }
}
