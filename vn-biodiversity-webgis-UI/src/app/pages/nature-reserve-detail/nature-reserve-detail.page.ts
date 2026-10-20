import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import type { NatureReserveDetail, NatureReserveRecord } from '../../data-access/models/nature-reserve.model';
import { NatureReserveService } from '../../data-access/services/nature-reserve.service';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';

type DetailTab = 'overview' | 'documents' | 'ecosystems' | 'inventories' | 'genetics';

@Component({
  selector: 'app-nature-reserve-detail-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './nature-reserve-detail.page.html',
  styleUrl: './nature-reserve-detail.page.css',
})
export class NatureReserveDetailPage implements OnDestroy {
  private readonly service = inject(NatureReserveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly detail = signal<NatureReserveDetail | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly tab = signal<DetailTab>('overview');
  private mapElement?: ElementRef<HTMLElement>;
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private renderedSourceId = '';

  @ViewChild('detailMap')
  set detailMap(value: ElementRef<HTMLElement> | undefined) { this.mapElement = value; if (value) window.setTimeout(() => void this.renderMap()); }

  constructor() {
    const sourceId = inject(ActivatedRoute).snapshot.paramMap.get('sourceId');
    if (!sourceId) { this.errorMessage.set('Thiếu mã khu bảo tồn.'); this.isLoading.set(false); return; }
    this.service.detail(sourceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => { this.detail.set(value); this.isLoading.set(false); window.setTimeout(() => void this.renderMap()); },
      error: () => { this.errorMessage.set('Không tải được hồ sơ khu bảo tồn.'); this.isLoading.set(false); },
    });
  }
  ngOnDestroy(): void { this.map?.remove(); }
  setTab(value: DetailTab): void { this.tab.set(value); }
  value(row: NatureReserveRecord, key: string): string {
    const raw = row[key];
    return raw === null || raw === undefined || raw === '' ? 'Chưa có dữ liệu' : String(raw);
  }
  imageFiles(detail: NatureReserveDetail): NatureReserveRecord[] {
    return detail.files.filter((file) => this.isImageFile(file));
  }
  area(value: number | null): string { return value === null ? 'Chưa có dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)} ha`; }

  private async renderMap(): Promise<void> {
    const detail = this.detail();
    if (!this.isBrowser || !this.mapElement || !detail) return;
    if (this.renderedSourceId === detail.sourceId && this.map) {
      this.map.invalidateSize();
      return;
    }
    this.leaflet ??= await import('leaflet');
    const L = this.leaflet;
    this.map?.remove();
    this.map = L.map(this.mapElement.nativeElement, { zoomControl: true }).setView([detail.latitude ?? 16.1, detail.longitude ?? 106.6], detail.latitude ? 10 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(this.map);
    if (detail.geometry?.features?.length) {
      const boundary = L.geoJSON(detail.geometry, { style: { color: '#087f4d', fillColor: '#49a66f', fillOpacity: .25, weight: 2.2 } }).addTo(this.map);
      const bounds = boundary.getBounds(); if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [24, 24] });
    } else if (detail.latitude !== null && detail.longitude !== null) {
      L.marker([detail.latitude, detail.longitude]).addTo(this.map).bindTooltip(detail.name).openTooltip();
    }
    this.renderedSourceId = detail.sourceId;
  }

  private isImageFile(file: NatureReserveRecord): boolean {
    const mimeType = String(file['mime_type'] ?? '');
    const sourceUrl = String(file['source_url'] ?? '');
    return mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(sourceUrl);
  }
}
