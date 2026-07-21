import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type {
  TaxonomyRepresentativeImage,
  TaxonomySearchItem,
  TaxonomySearchResponse,
  TaxonomyTreeNode,
} from '../../data-access/models/taxonomy.model';
import { TaxonomyService } from '../../data-access/services/taxonomy.service';
import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { FOOTER_CREDENTIAL_LINKS, VNSC_LOGO_SRC } from '../home/home.data';
import { TaxonomyBranchesPage } from './components/taxonomy-branches/taxonomy-branches.page';

interface TaxonomyState {
  q: string;
  rank: string;
  page: number;
}

interface TaxonomySearchTag {
  label: string;
  query: string;
}

type TaxonomyView = 'search' | 'tree';

@Component({
  selector: 'app-taxonomy-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CredentialsFooterComponent,
    PaginationComponent,
    SiteHeaderComponent,
    TaxonomyBranchesPage,
  ],
  templateUrl: './taxonomy.page.html',
  styleUrl: './taxonomy.page.css',
})
export class TaxonomyPage {
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly rankControl = new FormControl('', { nonNullable: true });
  protected readonly response = signal<TaxonomySearchResponse | null>(null);
  protected readonly selectedImage = signal<TaxonomyRepresentativeImage | null>(null);
  protected readonly selectedTreeNode = signal<TaxonomyTreeNode | null>(null);
  protected readonly selectedTreeHistory = signal<TaxonomyTreeNode[]>([]);
  protected readonly activeView = signal<TaxonomyView>('search');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly footerLinks = FOOTER_CREDENTIAL_LINKS;
  protected readonly vnscLogoSrc = VNSC_LOGO_SRC;
  protected readonly searchTags: TaxonomySearchTag[] = [
    { label: 'Animalia', query: 'Animalia' },
    { label: 'Plantae', query: 'Plantae' },
    { label: 'Amphibia', query: 'Amphibia' },
    { label: 'Magnoliaceae', query: 'Magnoliaceae' },
    { label: 'Ba ba', query: 'ba ba' },
    { label: 'Bọ hung', query: 'bọ hung' },
  ];
  protected readonly taxonomyTreeRoots = signal<TaxonomyTreeNode[]>([]);
  protected readonly taxonomyTreeView = computed(() =>
    this.focusTree(this.taxonomyTreeRoots(), this.selectedTreeNode()?.taxonId ?? null),
  );
  protected readonly isTreeLoading = signal(false);

  private readonly taxonomyService = inject(TaxonomyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private requestId = 0;

  constructor() {
    this.loadTreeRoots();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state: TaxonomyState = {
        q: params.get('q') ?? '',
        rank: params.get('rank') ?? '',
        page: this.parsePage(params.get('page')),
      };

      this.searchControl.setValue(state.q, { emitEvent: false });
      this.rankControl.setValue(state.rank, { emitEvent: false });
      this.search(state);
    });
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();
    this.search(this.createState(1));
  }

  protected applyRank(rank: string): void {
    this.rankControl.setValue(rank, { emitEvent: false });
    this.search(this.createState(1));
  }

  protected applySearchTag(tag: TaxonomySearchTag): void {
    this.searchControl.setValue(tag.query, { emitEvent: false });
    this.search(this.createState(1));
  }

  protected clearFilters(): void {
    this.rankControl.setValue('', { emitEvent: false });
    this.search(this.createState(1));
  }

  protected goToPage(page: number): void {
    const data = this.response();

    if (!data || page < 1 || page > data.totalPages || page === data.page) {
      return;
    }

    this.search(this.createState(page));
  }

  protected pageNumbers(data: TaxonomySearchResponse): number[] {
    const start = Math.max(1, data.page - 2);
    const end = Math.min(data.totalPages, data.page + 2);
    const pages: number[] = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  protected displayName(item: TaxonomySearchItem): string {
    return item.vietnameseName || item.canonicalName;
  }

  protected pathText(item: TaxonomySearchItem): string {
    return item.path.join(' → ');
  }

  protected relatedSpeciesQuery(item: TaxonomySearchItem): Record<string, string> {
    return { taxonId: item.taxonId };
  }

  protected selectTreeNode(node: TaxonomyTreeNode): void {
    const currentNode = this.selectedTreeNode();

    if (currentNode?.taxonId === node.taxonId && node.children?.length) {
      this.taxonomyTreeRoots.update((roots) => this.attachChildren(roots, node.taxonId, []));
      this.selectedTreeNode.set(this.findTreeNode(this.taxonomyTreeRoots(), node.taxonId) ?? node);
      return;
    }

    if (currentNode && currentNode.taxonId !== node.taxonId) {
      this.selectedTreeHistory.update((history) => [...history.slice(-5), currentNode]);
    }

    this.selectedTreeNode.set(node);

    if ((node.childCount ?? 0) > 0 && !(node.children?.length)) {
      this.loadTreeChildren(node.taxonId);
    }
  }

  protected selectedTreeNodeId(): string | null {
    return this.selectedTreeNode()?.taxonId ?? null;
  }

  protected canGoBackTreeNode(): boolean {
    return this.selectedTreeHistory().length > 0;
  }

  protected goBackTreeNode(): void {
    const history = this.selectedTreeHistory();
    const previousNode = history.at(-1);

    if (!previousNode) {
      return;
    }

    this.selectedTreeHistory.set(history.slice(0, -1));
    this.selectedTreeNode.set(previousNode);
  }

  protected switchView(view: TaxonomyView): void {
    this.activeView.set(view);
  }

  protected openImage(image: TaxonomyRepresentativeImage): void {
    this.selectedImage.set(image);
  }

  protected closeImage(): void {
    this.selectedImage.set(null);
  }

  protected displayImageUrl(image: TaxonomyRepresentativeImage): string {
    return image.metadata?.sourceImageUrl || image.metadata?.thumbnailUrl || image.imageUrl;
  }

  protected imageResolution(image: TaxonomyRepresentativeImage): string {
    const width = image.metadata?.imageWidth ?? image.width;
    const height = image.metadata?.imageHeight ?? image.height;

    return width && height ? `${width} x ${height}px` : 'Chưa có kích thước';
  }

  protected fileSize(image: TaxonomyRepresentativeImage): string {
    const size = image.metadata?.imageFileSize ?? image.sizeBytes;

    if (!size) {
      return 'Chưa có dung lượng';
    }

    if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }

    return `${Math.round(size / 1024)} KB`;
  }

  private search(state: TaxonomyState): void {
    if (!this.isBrowser) {
      this.isLoading.set(false);
      return;
    }

    const currentRequestId = this.requestId + 1;
    this.requestId = currentRequestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.taxonomyService
      .search({
        q: state.q,
        rank: state.rank,
        page: state.page,
        limit: 20,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (currentRequestId !== this.requestId) {
            return;
          }

          this.response.set(response);
          this.isLoading.set(false);
        },
        error: () => {
          if (currentRequestId !== this.requestId) {
            return;
          }

          this.errorMessage.set('Không tải được dữ liệu phân loại sinh học từ máy chủ.');
          this.response.set(null);
          this.isLoading.set(false);
        },
      });
  }

  private loadTreeRoots(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isTreeLoading.set(true);
    this.taxonomyService
      .treeRoots()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roots) => {
          this.taxonomyTreeRoots.set(roots);
          this.selectedTreeNode.set(roots[0] ?? null);
          this.isTreeLoading.set(false);
        },
        error: () => {
          this.taxonomyTreeRoots.set([]);
          this.isTreeLoading.set(false);
        },
      });
  }

  private loadTreeChildren(taxonId: string): void {
    this.taxonomyService
      .treeChildren(taxonId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (children) => {
          this.taxonomyTreeRoots.update((roots) => this.attachChildren(roots, taxonId, children));
          const selectedNode = this.findTreeNode(this.taxonomyTreeRoots(), taxonId);

          if (selectedNode) {
            this.selectedTreeNode.set(selectedNode);
          }
        },
      });
  }

  private attachChildren(
    nodes: TaxonomyTreeNode[],
    taxonId: string,
    children: TaxonomyTreeNode[],
  ): TaxonomyTreeNode[] {
    return nodes.map((node) => {
      if (node.taxonId === taxonId) {
        return { ...node, children };
      }

      if (node.children?.length) {
        return {
          ...node,
          children: this.attachChildren(node.children, taxonId, children),
        };
      }

      return node;
    });
  }

  private findTreeNode(nodes: TaxonomyTreeNode[], taxonId: string): TaxonomyTreeNode | null {
    for (const node of nodes) {
      if (node.taxonId === taxonId) {
        return node;
      }

      const child = this.findTreeNode(node.children ?? [], taxonId);

      if (child) {
        return child;
      }
    }

    return null;
  }

  private focusTree(nodes: TaxonomyTreeNode[], selectedTaxonId: string | null): TaxonomyTreeNode[] {
    if (!selectedTaxonId) {
      return nodes;
    }

    const rootNode = nodes[0];

    if (!rootNode || rootNode.taxonId === selectedTaxonId) {
      return nodes;
    }

    return nodes
      .map((node) => this.pruneTreeToSelectedBranch(node, selectedTaxonId))
      .filter((node): node is TaxonomyTreeNode => Boolean(node));
  }

  private pruneTreeToSelectedBranch(node: TaxonomyTreeNode, selectedTaxonId: string): TaxonomyTreeNode | null {
    if (node.taxonId === selectedTaxonId) {
      return node;
    }

    const focusedChildren = (node.children ?? [])
      .map((child) => this.pruneTreeToSelectedBranch(child, selectedTaxonId))
      .filter((child): child is TaxonomyTreeNode => Boolean(child));

    if (!focusedChildren.length) {
      return null;
    }

    return {
      ...node,
      children: focusedChildren,
    };
  }

  private createState(page: number): TaxonomyState {
    return {
      q: this.searchControl.value.trim(),
      rank: this.rankControl.value,
      page,
    };
  }

  private parsePage(value: string | null): number {
    const page = Number(value);

    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }
}
