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
import { WebgisNationalParkPanelComponent } from './components/webgis-national-park-panel/webgis-national-park-panel.component';

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

const DEFAULT_GRID_SIZE = 0.25;
const MIN_ZOOM_GRID_SIZE = 0.03125;
const HEX_PARENT_MIN_ZOOM = 8;
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
    WebgisNationalParkPanelComponent,
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
  private readonly cellLayers = new Map<string, Leaflet.Polygon>();
  private readonly cellDetailCache = new Map<string, OccurrenceCellDetail>();
  private activeOverviewGridSize = DEFAULT_GRID_SIZE;
  private pendingOverviewGridSize?: number;
  private zoomGridReloadTimer?: number;
  readonly nationalParkCloseToken = signal(0);

  get leafletInstance(): typeof Leaflet | null {
    return this.leaflet ?? null;
  }

  get mapInstance(): Leaflet.Map | null {
    return this.map ?? null;
  }

  get layerControlInstance(): Leaflet.Control.Layers | null {
    return this.layerControl ?? null;
  }

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

  loadOverview(options: { preserveView?: boolean; clearSelection?: boolean } = {}): void {
    if (!this.isBrowser) {
      return;
    }

    const shouldClearSelection = options.clearSelection ?? true;
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.occurrenceService.getMapOverview(this.currentQuery()).subscribe({
      next: (overview) => {
        this.activeOverviewGridSize = overview.gridSize;
        this.pendingOverviewGridSize = undefined;
        this.overview.set(overview);

        if (shouldClearSelection) {
          this.selectedCell.set(null);
          this.selectedRegionName.set('');
          this.selectedCellDetail.set(null);
          this.cellDetailError.set('');
          this.isCellDetailLoading.set(false);
        }

        this.isLoading.set(false);
        this.queueRenderOverview(options.preserveView);
      },
      error: () => {
        this.pendingOverviewGridSize = undefined;
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

  handleNationalParkLayerOpenChange(isOpen: boolean): void {
    if (!isOpen || !this.map || !this.occurrenceLayer) {
      return;
    }

    if (this.map.hasLayer(this.occurrenceLayer)) {
      this.map.removeLayer(this.occurrenceLayer);
    }
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

  private queueRenderOverview(preserveView = false): void {
    window.requestAnimationFrame(() => void this.renderOverview(0, preserveView));
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

    this.leaflet = this.resolveLeafletModule(await import('leaflet'));

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

    const satelliteLayer = this.leaflet.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri',
      },
    );
    const vectorLikeLayer = this.leaflet.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    );

    vectorLikeLayer.addTo(this.map);
    this.occurrenceLayer = this.leaflet.layerGroup().addTo(this.map);
    this.layerControl = this.leaflet
      .control
      .layers(
        {
          'Vector-style - Light map': vectorLikeLayer,
          'Raster - Satellite': satelliteLayer,
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

    this.bindOccurrenceLayerEvents();

    this.leaflet.control
      .scale({
        imperial: false,
        metric: true,
        position: 'bottomleft',
      })
      .addTo(this.map);

    this.map.on('click', () => this.resetSelection());
    this.map.on('zoomend', () => this.handleOccurrenceZoomChange());

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
    this.clearZoomGridReloadTimer();
  }

  private bindOccurrenceLayerEvents(): void {
    if (!this.map) {
      return;
    }

    this.map.on('overlayadd', (event: Leaflet.LayersControlEvent) => {
      if (event.layer === this.occurrenceLayer) {
        this.nationalParkCloseToken.update((value) => value + 1);
      }
    });
  }

  private clearLeafletContainerId(mapElement: HTMLElement | undefined): void {
    if (!mapElement) {
      return;
    }

    delete (mapElement as HTMLElement & { _leaflet_id?: number })._leaflet_id;
  }

  private resolveLeafletModule(module: typeof Leaflet | { default?: typeof Leaflet }): typeof Leaflet {
    if ('map' in module && typeof module.map === 'function') {
      return module;
    }

    const defaultModule = (module as { default?: typeof Leaflet }).default;

    if (defaultModule && typeof defaultModule.map === 'function') {
      return defaultModule;
    }

    throw new Error('Leaflet module could not be loaded.');
  }

  private async renderOverview(retryCount = 0, preserveView = false): Promise<void> {
    if (!this.isBrowser || !this.overview()) {
      return;
    }

    if (!this.map || !this.leaflet) {
      await this.initializeMap();
    }

    if (!this.map || !this.leaflet) {
      if (retryCount < 10) {
        window.setTimeout(() => void this.renderOverview(retryCount + 1, preserveView), 50);
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

    if (!preserveView) {
      this.focusVietnam();
    }

    this.renderParentHexagonLayer(overview);

    overview.cells.forEach((cell) => {
      const hexagon = this.leaflet!.polygon(
        this.getHexagonLatLngs(cell),
        {
          ...this.getCellStyle(cell, this.selectedCell()?.cellId === cell.cellId),
          pane: 'occurrenceGridPane',
        },
      );

      hexagon.bindTooltip(() => this.escapeHtml(this.buildRegionLabel(cell)), {
        className: 'occurrence-region-tooltip',
        direction: 'top',
        sticky: true,
      });

      hexagon.bindPopup(() => this.buildCellPopup(cell), {
        className: 'occurrence-cell-popup',
        maxWidth: 320,
      });

      hexagon.on('click', (event) => {
        this.leaflet!.DomEvent.stopPropagation(event);
        this.selectCell(cell);
      });
      hexagon.addTo(this.occurrenceLayer ?? this.map!);
      this.cellLayers.set(cell.cellId, hexagon);
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

  private refreshHexagonShapes(): void {
    const overview = this.overview();

    if (!overview) {
      return;
    }

    overview.cells.forEach((cell) => {
      this.cellLayers.get(cell.cellId)?.setLatLngs(this.getHexagonLatLngs(cell));
    });
  }

  private handleOccurrenceZoomChange(): void {
    this.refreshHexagonShapes();

    if (!this.isOccurrenceGridVisible()) {
      return;
    }

    const nextGridSize = this.getAdaptiveGridSize();

    if (nextGridSize === this.activeOverviewGridSize || nextGridSize === this.pendingOverviewGridSize) {
      return;
    }

    this.clearZoomGridReloadTimer();
    this.zoomGridReloadTimer = window.setTimeout(() => {
      this.pendingOverviewGridSize = nextGridSize;
      this.loadOverview({ preserveView: true, clearSelection: true });
    }, 180);
  }

  private clearZoomGridReloadTimer(): void {
    if (this.zoomGridReloadTimer === undefined) {
      return;
    }

    window.clearTimeout(this.zoomGridReloadTimer);
    this.zoomGridReloadTimer = undefined;
  }

  private isOccurrenceGridVisible(): boolean {
    return !!this.map && !!this.occurrenceLayer && this.map.hasLayer(this.occurrenceLayer);
  }

  private getHexagonLatLngs(cell: OccurrenceMapCell): Leaflet.LatLngExpression[] {
    const gridSize = this.overview()?.gridSize ?? this.gridSize();
    const isRefinedGrid = gridSize < this.gridSize();

    return this.buildHexagonLatLngs(cell.latitude, cell.longitude, gridSize, {
      radius: isRefinedGrid ? 'child' : 'base',
      stagger: isRefinedGrid,
    });
  }

  private renderParentHexagonLayer(overview: OccurrenceMapOverview): void {
    if (!this.leaflet || !this.occurrenceLayer || !this.shouldRenderParentHexagons(overview)) {
      return;
    }

    const parentGridSize = this.gridSize();
    const parentCells = this.buildParentHexagonCells(overview.cells, parentGridSize);

    parentCells.forEach((cell) => {
      this.leaflet!
        .polygon(
          this.buildHexagonLatLngs(cell.latitude, cell.longitude, parentGridSize, {
            radius: 'parent',
            stagger: false,
          }),
          {
            color: '#1f7a4d',
            fillColor: '#65b982',
            fillOpacity: 0.1,
            opacity: 0.24,
            pane: 'occurrenceGridPane',
            interactive: false,
            weight: 1.2,
          },
        )
        .addTo(this.occurrenceLayer!);
    });
  }

  private shouldRenderParentHexagons(overview: OccurrenceMapOverview): boolean {
    const zoom = this.map?.getZoom() ?? INITIAL_MAP_ZOOM;

    return zoom >= HEX_PARENT_MIN_ZOOM && zoom < 8.25 && overview.gridSize < this.gridSize();
  }

  private buildParentHexagonCells(cells: OccurrenceMapCell[], parentGridSize: number): OccurrenceMapCell[] {
    const groups = new Map<string, OccurrenceMapCell>();

    cells.forEach((cell) => {
      const parentLatitude = Math.floor(cell.latitude / parentGridSize) * parentGridSize;
      const parentLongitude = Math.floor(cell.longitude / parentGridSize) * parentGridSize;
      const cellId = `${parentLatitude.toFixed(4)}:${parentLongitude.toFixed(4)}`;
      const existing = groups.get(cellId);

      if (existing) {
        existing.occurrenceCount += cell.occurrenceCount;
        existing.speciesCount += cell.speciesCount;
        existing.animalSpecies += cell.animalSpecies;
        existing.plantSpecies += cell.plantSpecies;
        existing.insectSpecies += cell.insectSpecies;
        existing.unknownSpecies += cell.unknownSpecies;
        return;
      }

      groups.set(cellId, {
        ...cell,
        cellId,
        latitude: parentLatitude,
        longitude: parentLongitude,
      });
    });

    const parentCells = Array.from(groups.values());
    const maxOccurrence = Math.max(...parentCells.map((cell) => cell.occurrenceCount), 1);

    return parentCells.map((cell) => ({
      ...cell,
      intensity: Math.min(cell.occurrenceCount / maxOccurrence, 1),
    }));
  }

  private buildHexagonLatLngs(
    latitude: number,
    longitude: number,
    gridSize: number,
    options: { radius: 'base' | 'parent' | 'child'; stagger: boolean },
  ): Leaflet.LatLngExpression[] {
    const rowIndex = Math.floor(latitude / gridSize);
    const centerLatitude = latitude + gridSize / 2;
    const centerLongitude =
      longitude + gridSize / 2 + (options.stagger && rowIndex % 2 !== 0 ? gridSize / 2 : 0);
    const radiusScale = {
      base: { latitude: 0.66, longitude: 0.58 },
      parent: { latitude: 0.66, longitude: 0.58 },
      child: { latitude: 0.66, longitude: 0.58 },
    }[options.radius];
    const latitudeRadius = gridSize * radiusScale.latitude;
    const longitudeRadius = gridSize * radiusScale.longitude;

    return Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index + 30);

      return [
        centerLatitude + latitudeRadius * Math.sin(angle),
        centerLongitude + longitudeRadius * Math.cos(angle),
      ];
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
      gridSize: this.getAdaptiveGridSize(),
      sourceGroup: this.sourceGroup(),
      yearFrom: this.parseYearFilter(this.yearFrom()),
      yearTo: this.parseYearFilter(this.yearTo()),
    };
  }

  private getAdaptiveGridSize(): number {
    const baseGridSize = this.gridSize();
    const zoom = this.map?.getZoom() ?? INITIAL_MAP_ZOOM;

    if (zoom >= 11.25) {
      return this.roundGridSize(Math.max(baseGridSize / 8, MIN_ZOOM_GRID_SIZE));
    }

    if (zoom >= 9.5) {
      return this.roundGridSize(Math.max(baseGridSize / 4, MIN_ZOOM_GRID_SIZE));
    }

    if (zoom >= 8.25) {
      return this.roundGridSize(Math.max(baseGridSize / 2, MIN_ZOOM_GRID_SIZE));
    }

    return this.roundGridSize(baseGridSize);
  }

  private roundGridSize(value: number): number {
    return Number(value.toFixed(4));
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


