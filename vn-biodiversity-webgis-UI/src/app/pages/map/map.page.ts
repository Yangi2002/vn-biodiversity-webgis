import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import { OccurrenceService } from '../../data-access/services/occurrence.service';
import type {
  OccurrenceCellDetail,
  OccurrenceMapCell,
  OccurrenceMapOverview,
} from '../../data-access/models/occurrence.model';
import type { OccurrenceOverviewQueryDto } from '../../data-access/dto/occurrence-query.dto';
import {
  DashboardMetricItem,
  DashboardMetricStripComponent,
} from '../../shared/components/dashboard-metric-strip/dashboard-metric-strip.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { OccurrenceCellDetailPanelComponent } from './components/occurrence-cell-detail-panel/occurrence-cell-detail-panel.component';
import { WebgisFilterPanelComponent } from './components/webgis-filter-panel/webgis-filter-panel.component';
import { WebgisInsightPanelComponent } from './components/webgis-insight-panel/webgis-insight-panel.component';

type SourceGroupFilter = NonNullable<OccurrenceOverviewQueryDto['sourceGroup']>;

interface VietnamProvinceFeature {
  properties?: {
    [key: string]: unknown;
    name?: string;
  };
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

const DEFAULT_GRID_SIZE = 0.5;
const VIETNAM_CENTER: Leaflet.LatLngExpression = [16.1, 106.6];
const INITIAL_MAP_ZOOM = 6.75;
const VIETNAM_FOCUS_BOUNDS: Leaflet.LatLngBoundsExpression = [
  [8.0, 101.8],
  [23.8, 110.0],
];

@Component({
  selector: 'app-map-page',
  imports: [
    DashboardMetricStripComponent,
    OccurrenceCellDetailPanelComponent,
    SiteHeaderComponent,
    WebgisFilterPanelComponent,
    WebgisInsightPanelComponent,
  ],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly occurrenceService = inject(OccurrenceService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('leafletMap')
  private set leafletMapRef(value: ElementRef<HTMLElement> | undefined) {
    this.leafletMapElement = value;

    if (value && this.map && this.map.getContainer() !== value.nativeElement) {
      this.destroyMapInstance();
    }

    if (this.isBrowser && value && this.overview()) {
      this.queueRenderOverview();
    }
  }

  readonly overview = signal<OccurrenceMapOverview | null>(null);
  readonly isLoading = signal(this.isBrowser);
  readonly errorMessage = signal('');
  readonly selectedCell = signal<OccurrenceMapCell | null>(null);
  readonly isInsightPanelExpanded = signal(true);
  readonly sourceGroup = signal<SourceGroupFilter>('all');
  readonly yearFrom = signal('');
  readonly yearTo = signal('');
  readonly gridSize = signal(DEFAULT_GRID_SIZE);
  readonly selectedRegionName = signal('');
  readonly selectedCellDetail = signal<OccurrenceCellDetail | null>(null);
  readonly isCellDetailLoading = signal(false);
  readonly cellDetailError = signal('');
  readonly overviewMetrics = computed<DashboardMetricItem[]>(() => {
    const summary = this.overview()?.summary;

    if (!summary) {
      return [];
    }

    return [
      { label: 'Occurrence', value: summary.totalOccurrences },
      { label: 'Số loài', value: summary.totalSpecies },
      { label: 'Động vật', value: summary.animalSpecies, accent: 'animal' },
      { label: 'Thực vật', value: summary.plantSpecies, accent: 'plant' },
      { label: 'Côn trùng', value: summary.insectSpecies, accent: 'insect' },
      {
        label: 'Observed year',
        value: `${summary.earliestObservedYear || 'N/A'}-${summary.latestObservedYear || 'N/A'}`,
      },
    ];
  });

  private leaflet?: typeof Leaflet;
  private leafletMapElement?: ElementRef<HTMLElement>;
  private map?: Leaflet.Map;
  private mapInitialization?: Promise<void>;
  private vietnamBounds?: Leaflet.LatLngBounds;
  private occurrenceLayer?: Leaflet.LayerGroup;
  private vietnamBoundaryLayer?: Leaflet.GeoJSON;
  private vietnamProvinceFeatures: VietnamProvinceFeature[] = [];
  private layerControl?: Leaflet.Control.Layers;
  private readonly cellLayers = new Map<string, Leaflet.Rectangle>();
  private readonly cellDetailCache = new Map<string, OccurrenceCellDetail>();

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadOverview();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      window.setTimeout(() => void this.initializeMap());
    }
  }

  ngOnDestroy(): void {
    this.destroyMapInstance();
  }

  loadOverview(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.occurrenceService.getMapOverview(this.currentQuery()).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.selectedCell.set(null);
        this.selectedCellDetail.set(null);
        this.cellDetailError.set('');
        this.isLoading.set(false);
        this.queueRenderOverview();
      },
      error: () => {
        this.errorMessage.set('Ch\u01b0a t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u b\u1ea3n \u0111\u1ed3. H\u00e3y ki\u1ec3m tra backend v\u00e0 database.');
        this.isLoading.set(false);
      },
    });
  }

  selectCell(cell: OccurrenceMapCell): void {
    this.selectedCell.set(cell);
    this.selectedRegionName.set(this.buildRegionLabel(cell));
    this.isInsightPanelExpanded.set(true);
    this.applyCellSelection(cell.cellId);
    this.loadCellDetail(cell);
  }

  resetSelection(): void {
    this.selectedCell.set(null);
    this.selectedRegionName.set('');
    this.selectedCellDetail.set(null);
    this.cellDetailError.set('');
    this.isCellDetailLoading.set(false);
    this.applyCellSelection('');
  }

  toggleInsightPanel(): void {
    this.isInsightPanelExpanded.update((isExpanded) => !isExpanded);
  }

  updateSourceGroup(value: string): void {
    this.sourceGroup.set(this.toSourceGroup(value));
  }

  updateGridSize(value: string): void {
    const parsed = Number(value);
    this.gridSize.set(Number.isFinite(parsed) ? parsed : DEFAULT_GRID_SIZE);
  }

  updateYearFrom(value: string): void {
    this.yearFrom.set(value.trim());
  }

  updateYearTo(value: string): void {
    this.yearTo.set(value.trim());
  }

  applyFilters(): void {
    this.loadOverview();
  }

  clearFilters(): void {
    this.sourceGroup.set('all');
    this.yearFrom.set('');
    this.yearTo.set('');
    this.gridSize.set(DEFAULT_GRID_SIZE);
    this.loadOverview();
  }

  private loadCellDetail(cell: OccurrenceMapCell): void {
    const cacheKey = this.buildCellDetailCacheKey(cell);
    const cachedDetail = this.cellDetailCache.get(cacheKey);

    if (cachedDetail) {
      this.selectedCellDetail.set(cachedDetail);
      this.cellDetailError.set('');
      this.isCellDetailLoading.set(false);
      return;
    }

    this.selectedCellDetail.set(null);
    this.cellDetailError.set('');
    this.isCellDetailLoading.set(true);

    this.occurrenceService.getCellDetail(cell.latitude, cell.longitude, this.currentQuery()).subscribe({
      next: (detail) => {
        if (this.selectedCell()?.cellId !== cell.cellId) {
          return;
        }

        this.cellDetailCache.set(cacheKey, detail);
        this.selectedCellDetail.set(detail);
        this.isCellDetailLoading.set(false);
      },
      error: () => {
        if (this.selectedCell()?.cellId !== cell.cellId) {
          return;
        }

        this.cellDetailError.set('Chưa tải được danh sách loài trong ô này.');
        this.isCellDetailLoading.set(false);
      },
    });
  }

  private buildCellDetailCacheKey(cell: OccurrenceMapCell): string {
    const query = this.currentQuery();

    return [
      cell.cellId,
      query.gridSize,
      query.sourceGroup,
      query.yearFrom ?? '',
      query.yearTo ?? '',
    ].join('|');
  }

  private queueRenderOverview(): void {
    window.requestAnimationFrame(() => void this.renderOverview());
  }

  private async initializeMap(): Promise<void> {
    if (!this.isBrowser || this.map) {
      return;
    }

    if (this.mapInitialization) {
      await this.mapInitialization;
      return;
    }

    this.mapInitialization = this.createMapInstance();

    try {
      await this.mapInitialization;
    } finally {
      this.mapInitialization = undefined;
    }
  }

  private async createMapInstance(): Promise<void> {
    const mapElement = this.leafletMapElement?.nativeElement;

    if (!mapElement) {
      return;
    }

    this.leaflet = await import('leaflet');

    if (this.map) {
      return;
    }

    this.clearLeafletContainerId(mapElement);

    this.map = this.leaflet
      .map(mapElement, {
        maxBounds: VIETNAM_FOCUS_BOUNDS,
        maxBoundsViscosity: 1,
        minZoom: 6,
        preferCanvas: true,
        scrollWheelZoom: true,
        zoomControl: true,
        zoomDelta: 0.5,
        zoomSnap: 0.25,
      })
      .setView(VIETNAM_CENTER, INITIAL_MAP_ZOOM);

    this.map.createPane('provinceBoundaryPane');
    this.map.createPane('occurrenceGridPane');
    const provincePane = this.map.getPane('provinceBoundaryPane');
    const occurrencePane = this.map.getPane('occurrenceGridPane');

    if (provincePane) {
      provincePane.style.zIndex = '385';
      provincePane.style.pointerEvents = 'none';
    }

    if (occurrencePane) {
      occurrencePane.style.zIndex = '430';
    }

    const rasterLayer = this.leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    });
    const satelliteLayer = this.leaflet.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri',
      },
    );
    const vectorLikeLayer = this.leaflet.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    );

    rasterLayer.addTo(this.map);
    this.occurrenceLayer = this.leaflet.layerGroup().addTo(this.map);
    this.layerControl = this.leaflet
      .control
      .layers(
        {
          'Raster - OpenStreetMap': rasterLayer,
          'Raster - Satellite': satelliteLayer,
          'Vector-style - Light map': vectorLikeLayer,
        },
        {
          'Vector - Occurrence grid': this.occurrenceLayer,
        },
        {
          collapsed: false,
          position: 'topleft',
        },
      )
      .addTo(this.map);

    this.leaflet.control
      .scale({
        imperial: false,
        metric: true,
        position: 'bottomleft',
      })
      .addTo(this.map);

    this.map.on('click', () => this.resetSelection());

    void this.loadVietnamBoundary();
  }

  private destroyMapInstance(): void {
    this.map?.remove();
    this.mapInitialization = undefined;
    this.clearLeafletContainerId(this.leafletMapElement?.nativeElement);
    this.map = undefined;
    this.occurrenceLayer = undefined;
    this.vietnamBoundaryLayer = undefined;
    this.layerControl = undefined;
    this.cellLayers.clear();
  }

  private clearLeafletContainerId(mapElement: HTMLElement | undefined): void {
    if (!mapElement) {
      return;
    }

    delete (mapElement as HTMLElement & { _leaflet_id?: number })._leaflet_id;
  }

  private async renderOverview(retryCount = 0): Promise<void> {
    if (!this.isBrowser || !this.overview()) {
      return;
    }

    if (!this.map || !this.leaflet) {
      await this.initializeMap();
    }

    if (!this.map || !this.leaflet) {
      if (retryCount < 10) {
        window.setTimeout(() => void this.renderOverview(retryCount + 1), 50);
      }

      return;
    }

    this.cellLayers.forEach((layer) => layer.removeFrom(this.map!));
    this.cellLayers.clear();
    this.occurrenceLayer?.clearLayers();

    const overview = this.overview()!;
    this.vietnamBounds = this.leaflet.latLngBounds(
      [overview.bounds.minLatitude, overview.bounds.minLongitude],
      [overview.bounds.maxLatitude, overview.bounds.maxLongitude],
    );

    this.map.setMaxBounds(this.vietnamBounds.pad(0.08));
    this.focusVietnam();

    overview.cells.forEach((cell) => {
      const rectangle = this.leaflet!.rectangle(
        [
          [cell.latitude, cell.longitude],
          [cell.latitude + overview.gridSize, cell.longitude + overview.gridSize],
        ],
        {
          ...this.getCellStyle(cell, this.selectedCell()?.cellId === cell.cellId),
          pane: 'occurrenceGridPane',
        },
      );

      rectangle.bindTooltip(() => this.escapeHtml(this.buildRegionLabel(cell)), {
        className: 'occurrence-region-tooltip',
        direction: 'top',
        sticky: true,
      });

      rectangle.bindPopup(() => this.buildCellPopup(cell), {
        className: 'occurrence-cell-popup',
        maxWidth: 320,
      });

      rectangle.on('click', (event) => {
        this.leaflet!.DomEvent.stopPropagation(event);
        this.selectCell(cell);
      });
      rectangle.addTo(this.occurrenceLayer ?? this.map!);
      this.cellLayers.set(cell.cellId, rectangle);
    });

    this.applyCellSelection(this.selectedCell()?.cellId ?? '');
    window.setTimeout(() => this.map?.invalidateSize());
    window.setTimeout(() => this.map?.invalidateSize(), 180);
  }

  private focusVietnam(): void {
    if (!this.map || !this.vietnamBounds) {
      return;
    }

    this.map.fitBounds(this.vietnamBounds, {
      padding: [28, 28],
      animate: false,
    });

    const focusedZoom = Math.max(this.map.getZoom(), INITIAL_MAP_ZOOM);
    this.map.setZoom(focusedZoom, { animate: false });
    this.map.panTo(VIETNAM_CENTER, { animate: false });
  }

  private async loadVietnamBoundary(): Promise<void> {
    if (!this.leaflet || !this.map || this.vietnamBoundaryLayer) {
      return;
    }

    try {
      const response = await fetch('/geo/vietnam-provinces.geojson');
      const geojson = await response.json();
      this.vietnamProvinceFeatures = Array.isArray(geojson?.features) ? geojson.features : [];

      this.vietnamBoundaryLayer = this.leaflet.geoJSON(geojson, {
        interactive: false,
        pane: 'provinceBoundaryPane',
        style: {
          color: '#135f3b',
          fillColor: '#1f7a4d',
          fillOpacity: 0.04,
          opacity: 0.82,
          weight: 1.15,
        },
      });

      this.vietnamBoundaryLayer.addTo(this.map);
      this.layerControl?.addOverlay(this.vietnamBoundaryLayer, 'Vector - Vietnam provinces');
    } catch {
      // Boundary is an enhancement layer. The occurrence grid should keep working without it.
    }
  }

  private findProvinceName(cell: OccurrenceMapCell): string | null {
    const samplePoints = this.getCellSamplePoints(cell);

    for (const [longitude, latitude] of samplePoints) {
      for (const feature of this.vietnamProvinceFeatures) {
        if (this.isPointInFeature(longitude, latitude, feature)) {
          return this.getFeatureRegionName(feature);
        }
      }
    }

    return null;
  }

  private getFeatureRegionName(feature: VietnamProvinceFeature): string | null {
    const properties = feature.properties;

    if (!properties) {
      return null;
    }

    const regionKeys = [
      'commune',
      'ward',
      'xa',
      'phuong',
      'district',
      'huyen',
      'quan',
      'name_3',
      'NAME_3',
      'name_2',
      'NAME_2',
      'province',
      'tinh',
      'name',
      'NAME_1',
    ];

    for (const key of regionKeys) {
      const value = properties[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private getCellSamplePoints(cell: OccurrenceMapCell): Array<[number, number]> {
    const size = this.overview()?.gridSize ?? this.gridSize();
    const minLongitude = cell.longitude;
    const minLatitude = cell.latitude;
    const offsets = [0.5, 0.25, 0.75, 0.1, 0.9];
    const points: Array<[number, number]> = [];

    offsets.forEach((longitudeOffset) => {
      offsets.forEach((latitudeOffset) => {
        points.push([
          minLongitude + size * longitudeOffset,
          minLatitude + size * latitudeOffset,
        ]);
      });
    });

    return points;
  }

  private isPointInFeature(longitude: number, latitude: number, feature: VietnamProvinceFeature): boolean {
    const geometry = feature.geometry;

    if (!geometry) {
      return false;
    }

    if (geometry.type === 'Polygon') {
      return this.isPointInPolygon(longitude, latitude, geometry.coordinates as number[][][]);
    }

    if (geometry.type === 'MultiPolygon') {
      return (geometry.coordinates as number[][][][]).some((polygon) =>
        this.isPointInPolygon(longitude, latitude, polygon),
      );
    }

    return false;
  }

  private isPointInPolygon(longitude: number, latitude: number, rings: number[][][]): boolean {
    const [outerRing, ...holes] = rings;

    if (!outerRing || !this.isPointInRing(longitude, latitude, outerRing)) {
      return false;
    }

    return !holes.some((hole) => this.isPointInRing(longitude, latitude, hole));
  }

  private isPointInRing(longitude: number, latitude: number, ring: number[][]): boolean {
    let isInside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersects =
        yi > latitude !== yj > latitude &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || Number.EPSILON) + xi;

      if (intersects) {
        isInside = !isInside;
      }
    }

    return isInside;
  }

  private applyCellSelection(cellId: string): void {
    const overview = this.overview();

    if (!overview) {
      return;
    }

    overview.cells.forEach((cell) => {
      this.cellLayers.get(cell.cellId)?.setStyle(this.getCellStyle(cell, cell.cellId === cellId));
    });
  }

  private getCellStyle(cell: OccurrenceMapCell, isSelected: boolean): Leaflet.PathOptions {
    const color = this.cellColor(cell);

    return {
      color: isSelected ? '#10291c' : color,
      fillColor: color,
      fillOpacity: isSelected ? 0.78 : 0.32 + Math.min(cell.intensity * 0.42, 0.42),
      opacity: isSelected ? 0.95 : 0.72,
      weight: isSelected ? 2.4 : 1,
    };
  }

  private buildCellPopup(cell: OccurrenceMapCell): string {
    const regionName = this.escapeHtml(this.buildRegionLabel(cell));

    return `
      <strong>${cell.occurrenceCount.toLocaleString('vi-VN')} occurrence</strong>
      <span>${regionName}</span>
    `;
  }

  private buildRegionLabel(cell: OccurrenceMapCell): string {
    return this.findProvinceName(cell) ?? 'Ch\u01b0a x\u00e1c \u0111\u1ecbnh';
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private cellColor(cell: OccurrenceMapCell): string {
    if (cell.occurrenceCount >= 250) {
      return '#0f6f43';
    }

    if (cell.occurrenceCount >= 100) {
      return '#3c9f64';
    }

    if (cell.occurrenceCount >= 25) {
      return '#9ad29a';
    }

    return '#dff3df';
  }

  private currentQuery(): OccurrenceOverviewQueryDto {
    return {
      gridSize: this.gridSize(),
      sourceGroup: this.sourceGroup(),
      yearFrom: this.parseYearFilter(this.yearFrom()),
      yearTo: this.parseYearFilter(this.yearTo()),
    };
  }

  private parseYearFilter(value: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : undefined;
  }

  private toSourceGroup(value: string): SourceGroupFilter {
    if (value === 'animal' || value === 'plant' || value === 'insect') {
      return value;
    }

    return 'all';
  }
}


