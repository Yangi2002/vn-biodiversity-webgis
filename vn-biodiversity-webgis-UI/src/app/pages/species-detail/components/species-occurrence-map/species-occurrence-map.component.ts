import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type * as Leaflet from 'leaflet';

import type { SpeciesOccurrenceMap, SpeciesOccurrencePoint } from '../../../../data-access/models/occurrence.model';
import { OccurrenceService } from '../../../../data-access/services/occurrence.service';

const VIETNAM_CENTER: Leaflet.LatLngExpression = [16.1, 106.6];
const DEFAULT_ZOOM = 5.8;
const VIETNAM_FOCUS_BOUNDS: Leaflet.LatLngBoundsExpression = [
  [7.8, 101.4],
  [23.9, 110.2],
];
const MAP_INTERACTION_BOUNDS: Leaflet.LatLngBoundsExpression = [
  [3.8, 94.5],
  [27.0, 118.5],
];
const PIN_MARKER_HTML = '<span class="pin-marker-core"></span>';

@Component({
  selector: 'app-species-occurrence-map',
  imports: [DecimalPipe],
  templateUrl: './species-occurrence-map.component.html',
  styleUrl: './species-occurrence-map.component.css',
})
export class SpeciesOccurrenceMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly sourceTable = input.required<string>();
  readonly speciesId = input.required<string>();
  readonly speciesName = input('');
  readonly scientificName = input<string | null>(null);

  @ViewChild('mapContainer')
  private set mapContainerRef(value: ElementRef<HTMLElement> | undefined) {
    this.mapElement = value;

    if (this.isBrowser && value) {
      void this.initializeMap();
      this.renderPoints();
    }
  }

  protected readonly occurrenceMap = signal<SpeciesOccurrenceMap | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly selectedPoint = signal<SpeciesOccurrencePoint | null>(null);
  protected readonly isInsightPanelExpanded = signal(true);
  protected readonly brokenImageKeys = signal<Set<string>>(new Set());

  private readonly occurrenceService = inject(OccurrenceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markerLayer?: Leaflet.LayerGroup;
  private mapElement?: ElementRef<HTMLElement>;
  private mapInitialization?: Promise<void>;
  private lastRequestKey = '';

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      void this.initializeMap();
      this.loadSpeciesOccurrences();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceTable'] || changes['speciesId']) {
      this.loadSpeciesOccurrences();
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  protected yearRange(): string {
    const summary = this.occurrenceMap()?.summary;

    if (!summary?.earliestObservedYear || !summary.latestObservedYear) {
      return 'Chưa có dữ liệu';
    }

    return `${summary.earliestObservedYear}-${summary.latestObservedYear}`;
  }

  protected toggleInsightPanel(): void {
    this.isInsightPanelExpanded.update((isExpanded) => !isExpanded);
  }

  protected resetSelectedPoint(): void {
    this.selectedPoint.set(null);
    this.focusCurrentOccurrenceBounds();
  }

  protected coordinateText(point: SpeciesOccurrencePoint): string {
    return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
  }

  protected latitudeText(point: SpeciesOccurrencePoint): string {
    return point.latitude.toFixed(6);
  }

  protected longitudeText(point: SpeciesOccurrencePoint): string {
    return point.longitude.toFixed(6);
  }

  protected canShowOccurrenceImage(point: SpeciesOccurrencePoint): boolean {
    return Boolean(point.imageUrl && !this.brokenImageKeys().has(point.occurrenceKey));
  }

  protected markOccurrenceImageBroken(point: SpeciesOccurrencePoint): void {
    this.brokenImageKeys.update((keys) => new Set(keys).add(point.occurrenceKey));
  }

  protected placeText(point: SpeciesOccurrencePoint): string {
    return point.gadm || point.locality || point.location || 'Chưa rõ vùng ghi nhận';
  }

  protected regionText(point: SpeciesOccurrencePoint): string {
    return point.region || point.gadm || point.location || 'Chưa rõ region';
  }

  protected gadmLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      level0: 'Quốc gia',
      level1: 'Tỉnh / thành',
      level2: 'Quận / huyện',
      level3: 'Xã / phường',
    };

    return labels[level] ?? level;
  }

  protected gadmLevelNumber(level: string): string {
    return level.replace('level', 'Level ');
  }

  private loadSpeciesOccurrences(): void {
    if (!this.sourceTable() || !this.speciesId()) {
      return;
    }

    const requestKey = `${this.sourceTable()}:${this.speciesId()}`;

    if (requestKey === this.lastRequestKey) {
      return;
    }

    this.lastRequestKey = requestKey;
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.occurrenceService
      .getSpeciesOccurrences(this.sourceTable(), this.speciesId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (occurrenceMap) => {
          this.occurrenceMap.set(occurrenceMap);
          this.selectedPoint.set(null);
          this.brokenImageKeys.set(new Set());
          this.isLoading.set(false);
          this.renderPoints({ fitBounds: true });
        },
        error: () => {
          this.occurrenceMap.set(null);
          this.selectedPoint.set(null);
          this.errorMessage.set('Chưa tải được bản đồ phân bố của loài.');
          this.isLoading.set(false);
        },
      });
  }

  private async initializeMap(): Promise<void> {
    if (!this.isBrowser || this.map) {
      return;
    }

    if (this.mapInitialization) {
      await this.mapInitialization;
      return;
    }

    this.mapInitialization = this.createMap();

    try {
      await this.mapInitialization;
    } finally {
      this.mapInitialization = undefined;
    }
  }

  private async createMap(): Promise<void> {
    const element = this.mapElement?.nativeElement;

    if (!element) {
      return;
    }

    this.leaflet = await import('leaflet');

    if (this.map) {
      return;
    }

    this.clearLeafletContainerId(element);

    this.map = this.leaflet
      .map(element, {
        maxBounds: MAP_INTERACTION_BOUNDS,
        maxBoundsViscosity: 0.75,
        minZoom: 5,
        maxZoom: 18,
        preferCanvas: true,
        scrollWheelZoom: true,
        worldCopyJump: false,
        zoomControl: true,
      })
      .setView(VIETNAM_CENTER, DEFAULT_ZOOM);

    this.leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
        minZoom: 5,
        noWrap: true,
      })
      .addTo(this.map);

    this.markerLayer = this.leaflet.layerGroup().addTo(this.map);
    this.map.setMaxBounds(MAP_INTERACTION_BOUNDS);
    this.map.on('click', () => this.selectedPoint.set(null));
    window.setTimeout(() => this.map?.invalidateSize(), 120);
  }

  private renderPoints(options: { fitBounds?: boolean } = {}): void {
    if (!this.map || !this.leaflet || !this.markerLayer) {
      return;
    }

    this.markerLayer.clearLayers();
    const points = this.occurrenceMap()?.points ?? [];

    if (!points.length) {
      this.focusVietnam();
      return;
    }

    const bounds = this.leaflet.latLngBounds([]);

    points.forEach((point) => {
      const marker = this.createOccurrenceMarker(point);

      marker.bindPopup(this.buildPopup(point), {
        autoPan: false,
        autoPanPaddingBottomRight: [430, 60],
        autoPanPaddingTopLeft: [32, 32],
        className: 'species-occurrence-popup',
        maxWidth: 280,
      });
      marker.on('click', (event) => {
        this.leaflet!.DomEvent.stopPropagation(event);
        this.selectedPoint.set(point);
        this.isInsightPanelExpanded.set(true);
      });
      marker.addTo(this.markerLayer!);
      bounds.extend([point.latitude, point.longitude]);
    });

    if (options.fitBounds) {
      this.focusOccurrenceBounds(bounds);
    }
  }

  private createOccurrenceMarker(point: SpeciesOccurrencePoint): Leaflet.Marker {
    const pinIcon = this.leaflet!.divIcon({
      className: 'species-pin-marker',
      html: PIN_MARKER_HTML,
      iconAnchor: [14, 34],
      iconSize: [28, 34],
      popupAnchor: [0, -30],
    });

    return this.leaflet!.marker([point.latitude, point.longitude], {
      icon: pinIcon,
      keyboard: true,
      title: this.speciesName() || this.scientificName() || this.speciesId(),
    });
  }

  private focusOccurrenceBounds(bounds: Leaflet.LatLngBounds): void {
    if (!this.map) {
      return;
    }

    this.map.fitBounds(bounds.pad(0.22), {
      animate: false,
      maxZoom: 9,
      paddingBottomRight: [430, 70],
      paddingTopLeft: [410, 36],
    });
  }

  private focusCurrentOccurrenceBounds(): void {
    if (!this.leaflet) {
      return;
    }

    const points = this.occurrenceMap()?.points ?? [];

    if (!points.length) {
      this.focusVietnam();
      return;
    }

    const bounds = this.leaflet.latLngBounds([]);
    points.forEach((point) => bounds.extend([point.latitude, point.longitude]));
    this.focusOccurrenceBounds(bounds);
  }

  private focusVietnam(): void {
    this.map?.fitBounds(VIETNAM_FOCUS_BOUNDS, {
      animate: false,
      padding: [26, 26],
    });
  }

  private buildPopup(point: SpeciesOccurrencePoint): string {
    const location = this.escapeHtml(this.placeText(point));
    const region = this.escapeHtml(this.regionText(point));
    const regionLine = region && region !== location ? `<span>${region}</span>` : '';

    return `
      <span>${location}</span>
      ${regionLine}
    `;
  }

  private destroyMap(): void {
    this.map?.remove();
    this.clearLeafletContainerId(this.mapElement?.nativeElement);
    this.map = undefined;
    this.markerLayer = undefined;
    this.mapInitialization = undefined;
  }

  private clearLeafletContainerId(element: HTMLElement | undefined): void {
    if (!element) {
      return;
    }

    delete (element as HTMLElement & { _leaflet_id?: number })._leaflet_id;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
