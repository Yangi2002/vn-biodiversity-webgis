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
  private selectedLayer?: Leaflet.Layer;

  constructor(
    private readonly leaflet: typeof Leaflet,
    private readonly map: Leaflet.Map,
    private readonly options: NatureReserveLayerOptions,
  ) {
    this.group = leaflet.layerGroup();
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
  ): Leaflet.LatLngBounds {
    this.group.clearLayers();
    this.selectedLayer = undefined;
    const bounds = this.leaflet.latLngBounds([]);

    for (const reserve of reserves) {
      const layer = this.createFeature(reserve, bounds);
      if (!layer) continue;

      this.decorate(layer, reserve);
      layer.on('mouseover', () => this.hover(layer));
      layer.on('mouseout', () => this.unhover(layer));
      layer.on('click', () => {
        this.select(layer);
        onSelect?.(reserve);
      });
      layer.addTo(this.group);
    }

    return bounds;
  }

  dispose(): void {
    this.detach();
    this.group.clearLayers();
    this.selectedLayer = undefined;
  }

  private createFeature(
    reserve: NatureReserveListItem,
    bounds: Leaflet.LatLngBounds,
  ): Leaflet.Layer | null {
    if (reserve.geometry?.features.length) {
      const feature = this.leaflet.geoJSON(reserve.geometry, { style: this.options.style });
      const featureBounds = feature.getBounds();
      if (featureBounds.isValid()) bounds.extend(featureBounds);
      return feature;
    }

    if (reserve.latitude === null || reserve.longitude === null) return null;

    const position: Leaflet.LatLngTuple = [reserve.latitude, reserve.longitude];
    bounds.extend(position);
    return this.leaflet.circleMarker(position, {
      ...this.options.style,
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
