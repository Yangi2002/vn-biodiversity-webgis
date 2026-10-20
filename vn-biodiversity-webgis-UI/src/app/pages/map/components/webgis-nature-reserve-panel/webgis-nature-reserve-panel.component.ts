import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type * as Leaflet from 'leaflet';
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
  @Input() leaflet: typeof Leaflet | null = null;
  @Input() map: Leaflet.Map | null = null;
  @Input() closeToken = 0;
  @Output() readonly layerOpenChange = new EventEmitter<boolean>();
  readonly isExpanded = signal(false);
  readonly isLoading = signal(false);
  readonly total = signal(0);
  readonly selected = signal<NatureReserveListItem | null>(null);
  readonly errorMessage = signal('');
  private layer?: Leaflet.LayerGroup;
  private selectedLayer?: Leaflet.Path;
  private loaded = false;
  private shouldOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['map'] || changes['leaflet']) this.ensureLayer();
    if (changes['closeToken'] && !changes['closeToken'].firstChange) this.close();
  }
  ngOnDestroy(): void { this.layer?.clearLayers(); if (this.layer && this.map?.hasLayer(this.layer)) this.map.removeLayer(this.layer); }
  toggle(): void { this.isExpanded() ? this.close() : this.open(); }
  close(): void {
    this.shouldOpen = false;
    if (this.layer && this.map?.hasLayer(this.layer)) this.map.removeLayer(this.layer);
    this.isExpanded.set(false);
    this.layerOpenChange.emit(false);
  }

  private open(): void {
    this.shouldOpen = true;
    this.ensureLayer();
    if (!this.layer || !this.map) return;
    if (!this.loaded) { this.load(); return; }
    this.showLayer();
  }
  private ensureLayer(): void { if (!this.layer && this.leaflet && this.map) this.layer = this.leaflet.layerGroup(); }
  private load(): void {
    if (!this.layer || !this.map || !this.leaflet) return;
    this.isLoading.set(true); this.errorMessage.set('');
    this.service.mapLayer().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.total.set(items.length);
        this.render(items);
        this.loaded = true;
        this.isLoading.set(false);
        if (this.shouldOpen) this.showLayer();
      },
      error: () => { this.errorMessage.set('Không tải được lớp khu bảo tồn.'); this.isLoading.set(false); },
    });
  }
  private render(items: NatureReserveListItem[]): void {
    const L = this.leaflet!;
    this.layer!.clearLayers();
    this.selectedLayer = undefined;
    this.selected.set(null);
    for (const item of items) {
      let shape: Leaflet.Layer | null = null;
      if (item.geometry?.features?.length) shape = L.geoJSON(item.geometry, { style: () => this.style(false) });
      else if (item.latitude !== null && item.longitude !== null) shape = L.circleMarker([item.latitude, item.longitude], { ...this.style(false), radius: 6, fillOpacity: .75 });
      if (!shape) continue;
      shape.bindTooltip(item.name, { sticky: true, className: 'nature-reserve-tooltip' });
      shape.on('click', () => {
        this.selectedLayer?.setStyle(this.style(false));
        this.selected.set(item);
        this.selectedLayer = this.pathFromLayer(shape);
        this.selectedLayer?.setStyle(this.style(true));
      });
      shape.addTo(this.layer!);
    }
  }
  private showLayer(): void {
    if (!this.layer || !this.map) return;
    this.layer.addTo(this.map);
    this.isExpanded.set(true);
    this.layerOpenChange.emit(true);
  }
  private pathFromLayer(layer: Leaflet.Layer): Leaflet.Path | undefined {
    if (layer instanceof this.leaflet!.Path) return layer;
    if (layer instanceof this.leaflet!.GeoJSON) {
      let path: Leaflet.Path | undefined;
      layer.eachLayer((child) => { if (!path && child instanceof this.leaflet!.Path) path = child; });
      return path;
    }
    return undefined;
  }
  private style(selected: boolean): Leaflet.PathOptions { return { color: selected ? '#7c2d12' : '#087f4d', fillColor: selected ? '#fb923c' : '#49a66f', fillOpacity: selected ? .38 : .2, weight: selected ? 2.8 : 1.7 }; }
}
