import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type * as Leaflet from 'leaflet';
import { NatureReserveLeafletLayer } from '../../../../data-access/map/nature-reserve-leaflet-layer';
import type { NatureReserveListItem } from '../../../../data-access/models/nature-reserve.model';
import { NatureReserveService } from '../../../../data-access/services/nature-reserve.service';

@Component({
  selector: 'app-webgis-nature-reserve-panel',
  imports: [RouterLink],
  templateUrl: './webgis-nature-reserve-panel.component.html',
  styleUrl: './webgis-nature-reserve-panel.component.css',
})
export class WebgisNatureReservePanelComponent implements OnChanges, OnDestroy {
  private readonly service = inject(NatureReserveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  @Input() leaflet: typeof Leaflet | null = null;
  @Input() map: Leaflet.Map | null = null;
  @Input() closeToken = 0;
  @Output() readonly layerOpenChange = new EventEmitter<boolean>();
  readonly isExpanded = signal(false);
  readonly isLoading = signal(false);
  readonly total = signal(0);
  readonly selected = signal<NatureReserveListItem | null>(null);
  readonly hovered = signal<NatureReserveListItem | null>(null);
  readonly errorMessage = signal('');
  private reserveMapLayer?: NatureReserveLeafletLayer;
  private loaded = false;
  private shouldOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['map'] || changes['leaflet']) {
      this.reserveMapLayer?.dispose();
      this.reserveMapLayer = undefined;
      this.loaded = false;
      this.ensureLayer();
    }
    if (changes['closeToken'] && !changes['closeToken'].firstChange) this.close();
  }
  ngOnDestroy(): void { this.reserveMapLayer?.dispose(); }
  toggle(): void { this.isExpanded() ? this.close() : this.open(); }
  close(): void {
    this.shouldOpen = false;
    this.reserveMapLayer?.detach();
    this.isExpanded.set(false);
    this.layerOpenChange.emit(false);
  }

  private open(): void {
    this.shouldOpen = true;
    this.ensureLayer();
    if (!this.reserveMapLayer || !this.map) return;
    if (!this.loaded) { this.load(); return; }
    this.showLayer();
  }
  private ensureLayer(): void {
    if (this.reserveMapLayer || !this.leaflet || !this.map) return;
    this.reserveMapLayer = new NatureReserveLeafletLayer(this.leaflet, this.map, {
      style: { color: '#087f4d', fillColor: '#49a66f', fillOpacity: 0.2, weight: 1.7 },
      hoverStyle: { color: '#075f3b', fillColor: '#64b982', fillOpacity: 0.34, weight: 2.5 },
      selectedStyle: { color: '#7c2d12', fillColor: '#fb923c', fillOpacity: 0.38, weight: 2.8 },
      markerRadius: 6,
      markerFillOpacity: 0.75,
      tooltipClassName: 'nature-reserve-tooltip',
      tooltipContent: (reserve) => this.tooltipContent(reserve),
    });
  }
  private load(): void {
    if (!this.reserveMapLayer || !this.map) return;
    this.isLoading.set(true); this.errorMessage.set('');
    this.service.mapLayer().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.total.set(items.length);
        // Attach before creating paths so the SVG elements exist when the
        // renderer binds direct pointer interactions to each boundary.
        if (this.shouldOpen) this.reserveMapLayer?.attach();
        this.render(items);
        this.loaded = true;
        this.isLoading.set(false);
        if (this.shouldOpen) this.showLayer();
      },
      error: () => { this.errorMessage.set('Không tải được lớp khu bảo tồn.'); this.isLoading.set(false); },
    });
  }
  private render(items: NatureReserveListItem[]): void {
    this.selected.set(null);
    this.hovered.set(null);
    this.reserveMapLayer?.replace(
      items,
      (item) => this.updateFromMap(() => {
        this.selected.set(item);
        this.hovered.set(null);
      }),
      (item) => this.updateFromMap(() => this.hovered.set(item)),
    );
  }

  private updateFromMap(update: () => void): void {
    this.zone.run(() => {
      update();
      this.changeDetector.detectChanges();
    });
  }

  displayedReserve(): NatureReserveListItem | null {
    return this.selected() ?? this.hovered();
  }

  clearSelection(): void {
    this.selected.set(null);
  }
  private showLayer(): void {
    if (!this.reserveMapLayer) return;
    this.reserveMapLayer.attach();
    this.isExpanded.set(true);
    this.layerOpenChange.emit(true);
  }

  areaLabel(area: number | null): string {
    if (area === null) return 'Chưa rõ diện tích';
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(area)} ha`;
  }

  private tooltipContent(reserve: NatureReserveListItem): string {
    const details = [
      reserve.reserveType ?? 'Khu bảo tồn thiên nhiên',
      reserve.province,
      this.areaLabel(reserve.totalAreaHa),
      reserve.establishedYear ? `Thành lập ${reserve.establishedYear}` : null,
    ].filter((value): value is string => Boolean(value));
    return `<strong>${this.escapeHtml(reserve.name)}</strong><span>${details.map((value) => this.escapeHtml(value)).join(' · ')}</span>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character] ?? character);
  }
}
