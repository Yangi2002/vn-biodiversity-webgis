import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { NatureReserveLeafletLayer } from '../../data-access/map/nature-reserve-leaflet-layer';
import type { NatureReserveDocument, NatureReserveFilterOptions, NatureReserveListItem, NatureReserveSummary } from '../../data-access/models/nature-reserve.model';
import { NatureReserveService, type NatureReserveQuery } from '../../data-access/services/nature-reserve.service';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';

type ViewMode = 'list' | 'map' | 'stats' | 'documents';

const createDefaultQuery = (): NatureReserveQuery => ({
  q: '', province: '', reserveType: '', operatingStatus: '', yearFrom: '', yearTo: '',
  areaMin: '', areaMax: '', sort: 'name', page: 1, limit: 24,
});

@Component({
  selector: 'app-nature-reserves-page',
  imports: [DecimalPipe, FormsModule, RouterLink, SiteHeaderComponent],
  templateUrl: './nature-reserves.page.html',
  styleUrl: './nature-reserves.page.css',
})
export class NatureReservesPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly service = inject(NatureReserveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly mode = signal<ViewMode>('list');
  readonly items = signal<NatureReserveListItem[]>([]);
  readonly mapItems = signal<NatureReserveListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly options = signal<NatureReserveFilterOptions | null>(null);
  readonly summary = signal<NatureReserveSummary | null>(null);
  readonly documents = signal<NatureReserveDocument[]>([]);
  readonly documentTotal = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly selectedReserve = signal<NatureReserveListItem | null>(null);
  query: NatureReserveQuery = createDefaultQuery();
  documentQuery = '';
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private reserveMapLayer?: NatureReserveLeafletLayer;
  private mapElement?: ElementRef<HTMLElement>;

  @ViewChild('reserveMap')
  set reserveMap(value: ElementRef<HTMLElement> | undefined) {
    this.mapElement = value;
    if (value && this.isBrowser) window.setTimeout(() => void this.renderMap());
  }

  ngOnInit(): void {
    this.loadList();
    this.service.filterOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.options.set(value) });
    this.service.summary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.summary.set(value) });
    this.service.mapLayer().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => { this.mapItems.set(value); if (this.mode() === 'map') void this.renderMap(); } });
    this.loadDocuments();
  }
  ngAfterViewInit(): void { if (this.mode() === 'map') void this.renderMap(); }
  ngOnDestroy(): void {
    this.reserveMapLayer?.dispose();
    this.map?.remove();
  }

  setMode(mode: ViewMode): void { this.mode.set(mode); if (mode === 'map' && this.isBrowser) window.setTimeout(() => void this.renderMap()); }
  applyFilters(): void { this.query.page = 1; this.loadList(); }
  clearFilters(): void { this.query = createDefaultQuery(); this.loadList(); }
  goToPage(page: number): void { if (page < 1 || page > this.totalPages()) return; this.query.page = page; this.loadList(); if (this.isBrowser) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  loadDocuments(): void { this.service.documents({ q: this.documentQuery, limit: 50 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => { this.documents.set(value.items); this.documentTotal.set(value.total); } }); }
  maxCount(rows: Array<{ count: number }>): number { return Math.max(1, ...rows.map((row) => row.count)); }
  barWidth(value: number, max: number): string { return `${Math.max(3, Math.round((value / Math.max(1, max)) * 100))}%`; }
  shortText(value: string | null, max = 180): string { if (!value) return 'Chưa có mô tả.'; return value.length > max ? `${value.slice(0, max).trim()}...` : value; }
  areaLabel(value: number | null): string { return value === null ? 'Chưa rõ diện tích' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)} ha`; }

  private loadList(): void {
    this.isLoading.set(true); this.errorMessage.set('');
    this.service.list(this.query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => { this.items.set(value.items); this.total.set(value.total); this.page.set(value.page); this.totalPages.set(value.totalPages); this.isLoading.set(false); },
      error: () => { this.errorMessage.set('Không tải được danh sách khu bảo tồn.'); this.isLoading.set(false); },
    });
  }

  private async renderMap(): Promise<void> {
    if (!this.isBrowser || !this.mapElement || this.mode() !== 'map') return;
    this.leaflet ??= await import('leaflet');
    const L = this.leaflet;
    if (!this.map) {
      this.map = L.map(this.mapElement.nativeElement, { zoomControl: true }).setView([16.1, 106.6], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(this.map);
      this.reserveMapLayer = new NatureReserveLeafletLayer(L, this.map, {
        style: { color: '#087f4d', fillColor: '#49a66f', fillOpacity: 0.22, weight: 1.6 },
        markerRadius: 7,
        markerFillOpacity: 0.72,
        popupContent: (reserve) => this.popupContent(reserve),
      });
      this.reserveMapLayer.attach();
    }
    if (!this.reserveMapLayer) return;
    const bounds = this.reserveMapLayer.replace(
      this.mapItems(),
      (reserve) => this.selectedReserve.set(reserve),
    );
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [18, 18], maxZoom: 8 });
    window.setTimeout(() => this.map?.invalidateSize());
  }
  private popupContent(reserve: NatureReserveListItem): string {
    const detailUrl = `/nature-reserves/${encodeURIComponent(reserve.sourceId)}`;
    return `<strong>${this.escape(reserve.name)}</strong><br>${this.escape(reserve.reserveType ?? 'Khu bảo tồn')}<br>${this.escape(reserve.province ?? '')}<br><a href="${detailUrl}">Xem hồ sơ</a>`;
  }
  private escape(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char); }
}
