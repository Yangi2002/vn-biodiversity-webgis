import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';

import type { NationalParkListItem } from '../../../../data-access/models/national-park.model';
import { NationalParkService } from '../../../../data-access/services/national-park.service';

interface NationalParkMapItem extends NationalParkListItem {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-webgis-national-park-panel',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './webgis-national-park-panel.component.html',
  styleUrl: './webgis-national-park-panel.component.css',
})
export class WebgisNationalParkPanelComponent implements OnChanges, OnDestroy {
  private readonly nationalParkService = inject(NationalParkService);

  @Input() leaflet: typeof Leaflet | null = null;
  @Input() map: Leaflet.Map | null = null;
  @Input() closeToken = 0;
  @Output() readonly parkLayerOpenChange = new EventEmitter<boolean>();

  readonly selectedPark = signal<NationalParkMapItem | null>(null);
  readonly parkCount = signal(0);
  readonly visibleParkCount = signal(0);
  readonly isExpanded = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  private loaded = false;
  private layerGroup?: Leaflet.LayerGroup;
  private parkMarkers: Leaflet.Polygon[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['map'] || changes['leaflet']) {
      this.ensureLayer();
    }

    if (changes['closeToken'] && !changes['closeToken'].firstChange) {
      this.closeLayer();
    }
  }

  ngOnDestroy(): void {
    this.layerGroup?.clearLayers();

    if (this.layerGroup && this.map?.hasLayer(this.layerGroup)) {
      this.map.removeLayer(this.layerGroup);
    }
  }

  toggleExpanded(): void {
    const nextValue = !this.isExpanded();
    this.isExpanded.set(nextValue);

    if (nextValue) {
      this.openLayer();
    } else {
      this.closeLayer();
    }
  }

  clearSelection(): void {
    this.selectedPark.set(null);
    this.closeLayer();
    this.parkMarkers.forEach((marker) => this.updateMarkerStyle(marker, false));
  }

  imageUrl(park: NationalParkListItem): string {
    return park.thumbnailUrl ?? park.primaryImageUrl ?? '';
  }

  displayTitle(park: NationalParkListItem): string {
    return park.mapPopupTitle ?? park.title ?? 'Vườn quốc gia';
  }

  summaryText(park: NationalParkListItem, maxLength = 230): string {
    const rawText =
      park.mapPopupExcerpt ??
      park.managementAgency ??
      park.areaText ??
      'Chưa có mô tả tóm tắt cho vườn quốc gia này.';
    const text = rawText.replace(/\s+/g, ' ').trim();

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength).trim()}...`;
  }

  private ensureLayer(): void {
    if (!this.map || !this.leaflet) {
      return;
    }

    if (!this.map.getPane('nationalParkPane')) {
      this.map.createPane('nationalParkPane');
      const nationalParkPane = this.map.getPane('nationalParkPane');

      if (nationalParkPane) {
        nationalParkPane.style.zIndex = '455';
        nationalParkPane.style.pointerEvents = 'none';
      }
    }

    if (!this.layerGroup) {
      this.layerGroup = this.leaflet.layerGroup();
    }

    if (!this.loaded) {
      this.loaded = true;
      this.loadNationalParks();
    }
  }

  private loadNationalParks(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.nationalParkService.mapLayer().subscribe({
      next: (response) => {
        const parks = response.items
          .map((item) => this.toMapItem(item))
          .filter((item): item is NationalParkMapItem => Boolean(item));

        this.parkCount.set(response.total);
        this.visibleParkCount.set(parks.length);
        this.renderMarkers(parks);
        if (this.isExpanded()) {
          this.openLayer();
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Chưa tải được lớp vườn quốc gia.');
        this.isLoading.set(false);
      },
    });
  }

  private renderMarkers(parks: NationalParkMapItem[]): void {
    if (!this.leaflet || !this.layerGroup) {
      return;
    }

    this.layerGroup.clearLayers();
    this.parkMarkers = [];

    parks.forEach((park) => {
      const marker = this.leaflet!.polygon(this.buildParkBoundary(park), this.markerStyle(false));

      marker.bindTooltip(this.displayTitle(park), {
        className: 'national-park-tooltip',
        direction: 'top',
        sticky: true,
      });

      marker.on('click', (event) => {
        this.leaflet!.DomEvent.stopPropagation(event);
        this.selectedPark.set(park);
        this.isExpanded.set(true);
        this.parkMarkers.forEach((item) => this.updateMarkerStyle(item, item === marker));
      });

      marker.addTo(this.layerGroup!);
      this.parkMarkers.push(marker);
    });
  }

  private openLayer(): void {
    this.ensureLayer();
    this.isExpanded.set(true);

    if (this.map && this.layerGroup && !this.map.hasLayer(this.layerGroup)) {
      this.layerGroup.addTo(this.map);
    }

    this.setNationalParkPaneInteractive(true);
    this.parkLayerOpenChange.emit(true);
  }

  private closeLayer(): void {
    this.isExpanded.set(false);
    this.selectedPark.set(null);

    if (this.map && this.layerGroup && this.map.hasLayer(this.layerGroup)) {
      this.map.removeLayer(this.layerGroup);
    }

    this.setNationalParkPaneInteractive(false);
    this.parkLayerOpenChange.emit(false);
  }

  private setNationalParkPaneInteractive(isInteractive: boolean): void {
    const pane = this.map?.getPane('nationalParkPane');

    if (pane) {
      pane.style.pointerEvents = isInteractive ? 'auto' : 'none';
    }
  }

  private buildParkBoundary(park: NationalParkMapItem): Leaflet.LatLngExpression[] {
    const latitudeRadius = 0.18;
    const longitudeRadius = latitudeRadius / Math.max(Math.cos((park.latitude * Math.PI) / 180), 0.45);
    const shape: Array<[number, number]> = [
      [-0.72, -0.36],
      [-0.34, -0.84],
      [0.32, -0.72],
      [0.82, -0.28],
      [0.68, 0.28],
      [0.22, 0.78],
      [-0.48, 0.64],
      [-0.92, 0.12],
    ];

    return shape.map(([longitudeOffset, latitudeOffset]) => [
      park.latitude + latitudeOffset * latitudeRadius,
      park.longitude + longitudeOffset * longitudeRadius,
    ]);
  }

  private markerStyle(isSelected: boolean): Leaflet.PathOptions {
    return {
      color: isSelected ? '#075985' : '#0284c7',
      fillColor: isSelected ? '#38bdf8' : '#7dd3fc',
      fillOpacity: isSelected ? 0.28 : 0.14,
      opacity: isSelected ? 0.96 : 0.82,
      pane: 'nationalParkPane',
      weight: isSelected ? 2.8 : 1.8,
    };
  }

  private updateMarkerStyle(marker: Leaflet.Polygon, isSelected: boolean): void {
    marker.setStyle(this.markerStyle(isSelected));
  }

  private toMapItem(item: NationalParkListItem): NationalParkMapItem | null {
    const coordinate = this.mapCoordinate(item) ?? this.parseMapUrl(item.mapUrl) ?? this.parseCoordinate(item.coordinateText);

    if (!coordinate) {
      return null;
    }

    return {
      ...item,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  }

  private mapCoordinate(item: NationalParkListItem): { latitude: number; longitude: number } | null {
    if (
      item.mapLatitude === null ||
      item.mapLatitude === undefined ||
      item.mapLongitude === null ||
      item.mapLongitude === undefined
    ) {
      return null;
    }

    if (!this.isVietnamCoordinate(item.mapLatitude, item.mapLongitude)) {
      return null;
    }

    return {
      latitude: item.mapLatitude,
      longitude: item.mapLongitude,
    };
  }

  private parseMapUrl(value: string | null): { latitude: number; longitude: number } | null {
    if (!value) {
      return null;
    }

    const text = decodeURIComponent(value);
    const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (!match) {
        continue;
      }

      const latitude = Number(match[1]);
      const longitude = Number(match[2]);

      if (this.isVietnamCoordinate(latitude, longitude)) {
        return { latitude, longitude };
      }
    }

    return null;
  }

  private parseCoordinate(value: string | null): { latitude: number; longitude: number } | null {
    if (!value) {
      return null;
    }

    const latitude = this.extractAxisCoordinate(value, 'latitude');
    const longitude = this.extractAxisCoordinate(value, 'longitude');

    if (latitude !== null && longitude !== null && this.isVietnamCoordinate(latitude, longitude)) {
      return { latitude, longitude };
    }

    return null;
  }

  private extractAxisCoordinate(value: string, axis: 'latitude' | 'longitude'): number | null {
    const normalized = this.normalizeCoordinateText(value);
    const keywordPattern =
      axis === 'latitude'
        ? '(?:vi\\s*do|vi\\s*b(?:ac)?|vido|vb|north|latitude)'
        : '(?:kinh\\s*do|kinh\\s*d(?:ong)?|kinh\\s*t(?:ay)?|kd|east|longitude)';
    const candidates: number[] = [];
    const beforeKeywordPattern = new RegExp(`((?:\\d{1,6}\\D{0,10}){1,8})${keywordPattern}`, 'gi');
    const afterKeywordPattern = new RegExp(`${keywordPattern}((?:\\D{0,10}\\d{1,6}){1,8})`, 'gi');

    for (const match of normalized.matchAll(beforeKeywordPattern)) {
      candidates.push(...this.extractCoordinateNumbers(match[1], axis));
    }

    for (const match of normalized.matchAll(afterKeywordPattern)) {
      candidates.push(...this.extractCoordinateNumbers(match[1], axis));
    }

    const valid = candidates.filter((coordinate) => this.isCoordinateInAxisRange(coordinate, axis));

    if (!valid.length) {
      return null;
    }

    return valid.reduce((sum, coordinate) => sum + coordinate, 0) / valid.length;
  }

  private extractCoordinateNumbers(value: string, axis: 'latitude' | 'longitude'): number[] {
    const compactPrimeMatches = Array.from(value.matchAll(/\b(\d{5,6})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\b/g))
      .map((match) => this.compactDmsToDecimal(match[1], match[2], axis))
      .filter((coordinate): coordinate is number => coordinate !== null && this.isCoordinateInAxisRange(coordinate, axis));
    const compactMatches = Array.from(value.matchAll(/\b(\d{2,3})(\d{2})(\d{2}(?:[.,]\d+)?)\b/g))
      .map((match) => this.dmsToDecimal(match[1], match[2], match[3]))
      .filter((coordinate) => this.isCoordinateInAxisRange(coordinate, axis));
    const dmsMatches = Array.from(
      value.matchAll(/\b(\d{1,3})(?:\s*(?:do|deg|°)\s*|\s+)(\d{1,2})?(?:\s*(?:'|phut|′)\s*)?(\d{1,2}(?:[.,]\d+)?)?/g),
    )
      .map((match) => this.dmsToDecimal(match[1], match[2], match[3]))
      .filter((coordinate) => this.isCoordinateInAxisRange(coordinate, axis));

    return [...compactPrimeMatches, ...compactMatches, ...dmsMatches];
  }

  private dmsToDecimal(degree: string, minute?: string, second?: string): number {
    return Number(degree) + Number(minute ?? 0) / 60 + Number((second ?? '0').replace(',', '.')) / 3600;
  }

  private compactDmsToDecimal(value: string, second: string, axis: 'latitude' | 'longitude'): number | null {
    const degreeLength = axis === 'latitude' ? 2 : 3;

    if (value.length <= degreeLength) {
      return null;
    }

    const degree = value.slice(0, degreeLength);
    const minute = value.slice(degreeLength).slice(-2);

    return this.dmsToDecimal(degree, minute, second);
  }

  private normalizeCoordinateText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[“”″]/g, '"')
      .replace(/[’′]/g, "'")
      .replace(/\b(\d{1,3})\s+0\s+(\d{1,2})(?=\s*(?:'|phut|vi|kinh))/gi, '$1 do $2')
      .replace(/[;,]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private isCoordinateInAxisRange(coordinate: number, axis: 'latitude' | 'longitude'): boolean {
    return axis === 'latitude' ? coordinate >= 8 && coordinate <= 24 : coordinate >= 102 && coordinate <= 110;
  }

  private isVietnamCoordinate(latitude: number, longitude: number): boolean {
    return latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110;
  }
}
