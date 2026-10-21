import type * as Leaflet from 'leaflet';
import type { NatureReserveListItem } from '../models/nature-reserve.model';

export interface NatureReserveLayerOptions {
  style: Leaflet.PathOptions;
  hoverStyle?: Leaflet.PathOptions;
  selectedStyle?: Leaflet.PathOptions;
  markerRadius?: number;
  markerFillOpacity?: number;
  tooltipClassName?: string;
  tooltipContent?: (reserve: NatureReserveListItem) => string;
  popupContent?: (reserve: NatureReserveListItem) => string;
}

export class NatureReserveLeafletLayer {
  private readonly group: Leaflet.LayerGroup;
  private readonly renderer: Leaflet.Renderer;
  private readonly reserveRecords: Array<{ layer: Leaflet.Layer; reserve: NatureReserveListItem }> = [];
  private selectedLayer?: Leaflet.Layer;
  private hoveredLayer?: Leaflet.Layer;
  private selectCallback?: (reserve: NatureReserveListItem) => void;
  private hoverCallback?: (reserve: NatureReserveListItem | null) => void;

  constructor(
    private readonly leaflet: typeof Leaflet,
    private readonly map: Leaflet.Map,
    private readonly options: NatureReserveLayerOptions,
  ) {
    this.group = leaflet.layerGroup();
    // The main WebGIS prefers canvas for thousands of occurrence cells. Reserve
    // boundaries need their own SVG renderer so each shape has a reliable hover
    // and click target without changing occurrence rendering performance.
    this.renderer = leaflet.svg({ padding: 0.25 });
    this.map.on('mousemove', this.handleMapMouseMove);
    this.map.on('click', this.handleMapClick);
  }

  attach(): void {
    if (!this.map.hasLayer(this.group)) this.group.addTo(this.map);
  }

  detach(): void {
    if (this.map.hasLayer(this.group)) this.map.removeLayer(this.group);
  }

  replace(
    reserves: readonly NatureReserveListItem[],
    onSelect?: (reserve: NatureReserveListItem) => void,
    onHover?: (reserve: NatureReserveListItem | null) => void,
  ): Leaflet.LatLngBounds {
    this.group.clearLayers();
    this.reserveRecords.length = 0;
    this.selectedLayer = undefined;
    this.hoveredLayer = undefined;
    this.selectCallback = onSelect;
    this.hoverCallback = onHover;
    const bounds = this.leaflet.latLngBounds([]);

    for (const reserve of reserves) {
      const layer = this.createFeature(reserve, bounds);
      if (!layer) continue;

      this.reserveRecords.push({ layer, reserve });
      layer.addTo(this.group);
      for (const target of this.interactionTargets(layer)) {
        this.decorate(target, reserve);
        this.bindInteraction(target, layer, reserve, onSelect, onHover);
      }
    }

    return bounds;
  }

  dispose(): void {
    this.detach();
    this.group.clearLayers();
    this.reserveRecords.length = 0;
    this.selectedLayer = undefined;
    this.hoveredLayer = undefined;
    this.map.off('mousemove', this.handleMapMouseMove);
    this.map.off('click', this.handleMapClick);
  }

  private createFeature(
    reserve: NatureReserveListItem,
    bounds: Leaflet.LatLngBounds,
  ): Leaflet.Layer | null {
    if (reserve.geometry?.features.length) {
      const feature = this.leaflet.geoJSON(reserve.geometry, {
        style: { ...this.options.style, renderer: this.renderer, interactive: true },
      });
      const featureBounds = feature.getBounds();
      if (featureBounds.isValid()) bounds.extend(featureBounds);
      return feature;
    }

    if (reserve.latitude === null || reserve.longitude === null) return null;

    const position: Leaflet.LatLngTuple = [reserve.latitude, reserve.longitude];
    bounds.extend(position);
    return this.leaflet.circleMarker(position, {
      ...this.options.style,
      renderer: this.renderer,
      interactive: true,
      radius: this.options.markerRadius ?? 7,
      fillOpacity: this.options.markerFillOpacity ?? this.options.style.fillOpacity,
    });
  }

  private decorate(layer: Leaflet.Layer, reserve: NatureReserveListItem): void {
    if (this.options.tooltipClassName) {
      layer.bindTooltip(this.options.tooltipContent?.(reserve) ?? reserve.name, {
        sticky: true,
        className: this.options.tooltipClassName,
        direction: 'top',
        opacity: 1,
      });
    }
    if (this.options.popupContent) layer.bindPopup(this.options.popupContent(reserve));
  }

  private interactionTargets(layer: Leaflet.Layer): Leaflet.Layer[] {
    if (!(layer instanceof this.leaflet.LayerGroup)) return [layer];
    return layer.getLayers().flatMap((child) => this.interactionTargets(child));
  }

  private bindInteraction(
    target: Leaflet.Layer,
    reserveLayer: Leaflet.Layer,
    reserve: NatureReserveListItem,
    onSelect: ((reserve: NatureReserveListItem) => void) | undefined,
    onHover: ((reserve: NatureReserveListItem | null) => void) | undefined,
  ): void {
    const onEnter = () => {
      this.hover(reserveLayer);
      onHover?.(reserve);
    };
    const onLeave = () => {
      this.unhover(reserveLayer);
      onHover?.(null);
    };
    const onClick = (event?: Event) => {
      event?.stopPropagation();
      this.select(reserveLayer);
      onSelect?.(reserve);
    };
    const element = target instanceof this.leaflet.Path ? target.getElement() : null;

    if (element) {
      element.addEventListener('pointerenter', onEnter);
      element.addEventListener('pointerleave', onLeave);
      element.addEventListener('click', onClick);
      return;
    }

    target.on('mouseover', onEnter);
    target.on('mouseout', onLeave);
    target.on('click', () => onClick());
  }

  private readonly handleMapMouseMove = (event: Leaflet.LeafletMouseEvent): void => {
    const record = this.findReserveAt(event.latlng);
    const nextLayer = record?.layer;

    if (nextLayer === this.hoveredLayer) return;
    if (this.hoveredLayer) this.unhover(this.hoveredLayer);
    this.hoveredLayer = nextLayer;

    if (record) {
      this.hover(record.layer);
      this.hoverCallback?.(record.reserve);
    } else {
      this.hoverCallback?.(null);
    }
  };

  private readonly handleMapClick = (event: Leaflet.LeafletMouseEvent): void => {
    const record = this.findReserveAt(event.latlng);
    if (!record) return;
    this.select(record.layer);
    this.selectCallback?.(record.reserve);
  };

  private findReserveAt(point: Leaflet.LatLng): { layer: Leaflet.Layer; reserve: NatureReserveListItem } | undefined {
    return this.reserveRecords
      .filter((record) => this.layerContainsPoint(record.layer, point))
      .sort((left, right) => this.layerArea(left.layer) - this.layerArea(right.layer))[0];
  }

  private layerContainsPoint(layer: Leaflet.Layer, point: Leaflet.LatLng): boolean {
    if (layer instanceof this.leaflet.LayerGroup) {
      return layer.getLayers().some((child) => this.layerContainsPoint(child, point));
    }
    if (layer instanceof this.leaflet.CircleMarker) {
      return layer.getLatLng().distanceTo(point) <= Math.max(layer.getRadius() * 160, 2500);
    }
    if (!(layer instanceof this.leaflet.Polygon) || !layer.getBounds().contains(point)) return false;
    return this.polygonRings(layer.getLatLngs()).some((ring) => this.pointInRing(point, ring));
  }

  private layerArea(layer: Leaflet.Layer): number {
    const boundedLayer = layer as Leaflet.Layer & { getBounds?: () => Leaflet.LatLngBounds };
    const bounds = boundedLayer.getBounds?.();
    if (!bounds?.isValid()) return Number.MAX_VALUE;
    return Math.abs((bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest()));
  }

  private polygonRings(latLngs: unknown): Leaflet.LatLng[][] {
    if (!Array.isArray(latLngs)) return [];
    if (latLngs.length && this.isLatLng(latLngs[0])) return [latLngs as Leaflet.LatLng[]];
    return latLngs.flatMap((item) => this.polygonRings(item));
  }

  private isLatLng(value: unknown): value is Leaflet.LatLng {
    return !!value && typeof value === 'object' && 'lat' in value && 'lng' in value;
  }

  private pointInRing(point: Leaflet.LatLng, ring: Leaflet.LatLng[]): boolean {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const currentPoint = ring[index];
      const previousPoint = ring[previous];
      const crosses = ((currentPoint.lat > point.lat) !== (previousPoint.lat > point.lat))
        && (point.lng < ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat))
          / (previousPoint.lat - currentPoint.lat) + currentPoint.lng);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  private select(layer: Leaflet.Layer): void {
    if (!this.options.selectedStyle) return;
    if (this.selectedLayer) this.setStyle(this.selectedLayer, this.options.style);
    this.selectedLayer = layer;
    this.setStyle(layer, this.options.selectedStyle);
  }

  private hover(layer: Leaflet.Layer): void {
    if (layer !== this.selectedLayer && this.options.hoverStyle) this.setStyle(layer, this.options.hoverStyle);
  }

  private unhover(layer: Leaflet.Layer): void {
    const style = layer === this.selectedLayer ? this.options.selectedStyle : this.options.style;
    if (style) this.setStyle(layer, style);
  }

  private setStyle(layer: Leaflet.Layer, style: Leaflet.PathOptions): void {
    if (layer instanceof this.leaflet.Path || layer instanceof this.leaflet.GeoJSON) layer.setStyle(style);
  }
}
