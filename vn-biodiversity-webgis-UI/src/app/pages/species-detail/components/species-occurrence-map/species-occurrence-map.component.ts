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
const MAX_RENDERED_MARKERS = 500;

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
  readonly isEndangeredSpecies = input(false);

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
  protected readonly yearFromFilter = signal('');
  protected readonly yearToFilter = signal('');
  protected readonly sourceFilter = signal('all');
  protected readonly imageFilter = signal('all');

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

  protected resetFilters(): void {
    this.yearFromFilter.set('');
    this.yearToFilter.set('');
    this.sourceFilter.set('all');
    this.imageFilter.set('all');
    this.selectedPoint.set(null);
    this.renderPoints({ fitBounds: true });
  }

  protected updateYearFromFilter(value: string): void {
    this.yearFromFilter.set(value.trim());
  }

  protected updateYearToFilter(value: string): void {
    this.yearToFilter.set(value.trim());
  }

  protected updateSourceFilter(value: string): void {
    this.sourceFilter.set(value);
    this.applyMapFilters();
  }

  protected updateImageFilter(value: string): void {
    this.imageFilter.set(value);
    this.applyMapFilters();
  }

  protected applyMapFilters(): void {
    this.selectedPoint.set(null);
    this.renderPoints({ fitBounds: true });
  }

  protected coordinateText(point: SpeciesOccurrencePoint): string {
    return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
  }

  protected latitudeText(point: SpeciesOccurrencePoint): string {
    return this.displayLatitude(point).toFixed(this.isCoordinateProtected() ? 2 : 6);
  }

  protected longitudeText(point: SpeciesOccurrencePoint): string {
    return this.displayLongitude(point).toFixed(this.isCoordinateProtected() ? 2 : 6);
  }

  protected canShowOccurrenceImage(point: SpeciesOccurrencePoint): boolean {
    return Boolean(point.imageUrl && !this.brokenImageKeys().has(point.occurrenceKey));
  }

  protected markOccurrenceImageBroken(point: SpeciesOccurrencePoint): void {
    this.brokenImageKeys.update((keys) => new Set(keys).add(point.occurrenceKey));
  }

  protected filteredPointCount(): number {
    return this.filteredOccurrencePoints().length;
  }

  protected displayedPointCount(): number {
    return this.displayedOccurrencePoints().length;
  }

  protected isSamplingMarkers(): boolean {
    return this.filteredPointCount() > this.displayedPointCount();
  }

  protected sourceOptions(): string[] {
    const sources = new Set(
      (this.occurrenceMap()?.points ?? [])
        .map((point) => point.basisOfRecord || point.qualityGrade)
        .filter((source): source is string => Boolean(source)),
    );

    return Array.from(sources).sort((a, b) => a.localeCompare(b));
  }

  protected coordinatesNotice(): string {
    return this.isCoordinateProtected()
      ? 'Loài đang ở mức EN, tọa độ được làm mờ để hạn chế lộ vị trí nhạy cảm.'
      : 'Tọa độ đang hiển thị theo dữ liệu gốc.';
  }

  protected isCoordinateProtected(): boolean {
    return this.isEndangeredSpecies();
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
    const points = this.displayedOccurrencePoints();

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
      bounds.extend([this.displayLatitude(point), this.displayLongitude(point)]);
    });

    if (options.fitBounds) {
      this.focusOccurrenceBounds(bounds);
    }
  }

  private createOccurrenceMarker(point: SpeciesOccurrencePoint): Leaflet.Marker {
    const pinIcon = this.leaflet!.divIcon({
      className: this.isCoordinateProtected() ? 'species-pin-marker is-protected' : 'species-pin-marker',
      html: PIN_MARKER_HTML,
      iconAnchor: [14, 34],
      iconSize: [28, 34],
      popupAnchor: [0, -30],
    });

    return this.leaflet!.marker([this.displayLatitude(point), this.displayLongitude(point)], {
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

    const points = this.displayedOccurrencePoints();

    if (!points.length) {
      this.focusVietnam();
      return;
    }

    const bounds = this.leaflet.latLngBounds([]);
    points.forEach((point) => bounds.extend([this.displayLatitude(point), this.displayLongitude(point)]));
    this.focusOccurrenceBounds(bounds);
  }

  private filteredOccurrencePoints(): SpeciesOccurrencePoint[] {
    const points = this.occurrenceMap()?.points ?? [];
    const yearFrom = Number(this.yearFromFilter());
    const yearTo = Number(this.yearToFilter());
    const hasYearFrom = Number.isFinite(yearFrom) && this.yearFromFilter() !== '';
    const hasYearTo = Number.isFinite(yearTo) && this.yearToFilter() !== '';
    const source = this.sourceFilter();
    const imageMode = this.imageFilter();

    return points.filter((point) => {
      if (hasYearFrom && (!point.observedYear || point.observedYear < yearFrom)) {
        return false;
      }

      if (hasYearTo && (!point.observedYear || point.observedYear > yearTo)) {
        return false;
      }

      if (source !== 'all' && source !== (point.basisOfRecord || point.qualityGrade || '')) {
        return false;
      }

      if (imageMode === 'with-image' && !point.imageUrl) {
        return false;
      }

      if (imageMode === 'without-image' && point.imageUrl) {
        return false;
      }

      return true;
    });
  }

  private displayedOccurrencePoints(): SpeciesOccurrencePoint[] {
    return this.samplePoints(this.filteredOccurrencePoints(), MAX_RENDERED_MARKERS);
  }

  private samplePoints(points: SpeciesOccurrencePoint[], limit: number): SpeciesOccurrencePoint[] {
    if (points.length <= limit) {
      return points;
    }

    const step = points.length / limit;
    return Array.from({ length: limit }, (_, index) => points[Math.floor(index * step)]);
  }

  private displayLatitude(point: SpeciesOccurrencePoint): number {
    return this.isCoordinateProtected() ? this.blurCoordinate(point.latitude) : point.latitude;
  }

  private displayLongitude(point: SpeciesOccurrencePoint): number {
    return this.isCoordinateProtected() ? this.blurCoordinate(point.longitude) : point.longitude;
  }

  private blurCoordinate(value: number): number {
    return Math.round(value * 10) / 10;
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
