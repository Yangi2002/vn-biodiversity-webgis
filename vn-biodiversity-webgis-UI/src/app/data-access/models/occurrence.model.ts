export interface OccurrenceMapBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface OccurrenceMapSummary {
  totalOccurrences: number;
  totalSpecies: number;
  animalSpecies: number;
  plantSpecies: number;
  insectSpecies: number;
  unknownSpecies: number;
  earliestObservedYear: number | null;
  latestObservedYear: number | null;
}

export interface OccurrenceMapCell {
  cellId: string;
  latitude: number;
  longitude: number;
  occurrenceCount: number;
  speciesCount: number;
  animalSpecies: number;
  plantSpecies: number;
  insectSpecies: number;
  unknownSpecies: number;
  intensity: number;
}

export interface OccurrenceMapLegendItem {
  label: string;
  color: string;
  min: number;
  max: number | null;
}

export interface OccurrenceMapOverview {
  bounds: OccurrenceMapBounds;
  gridSize: number;
  summary: OccurrenceMapSummary;
  cells: OccurrenceMapCell[];
  legend: OccurrenceMapLegendItem[];
}

export interface OccurrenceCellSpecies {
  sourceTable: string;
  sourceLabel: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  orderName: string | null;
  className: string | null;
  occurrenceCount: number;
  detailUrl: string;
}

export interface OccurrenceCellTaxonomyGroup {
  rank: string;
  canonicalName: string;
  vietnameseName: string | null;
  speciesCount: number;
  occurrenceCount: number;
}

export interface OccurrenceCellDetail {
  cellId: string;
  latitude: number;
  longitude: number;
  gridSize: number;
  representativeSpecies: OccurrenceCellSpecies[];
  taxonomyGroups: OccurrenceCellTaxonomyGroup[];
}

export interface SpeciesOccurrenceSummary {
  totalOccurrences: number;
  earliestObservedYear: number | null;
  latestObservedYear: number | null;
  imageCount: number;
}

export interface SpeciesOccurrencePoint {
  occurrenceKey: string;
  latitude: number;
  longitude: number;
  observedDate: string | null;
  observedYear: number | null;
  location: string | null;
  locality: string | null;
  region: string | null;
  gadm: string | null;
  gadmLevels: SpeciesOccurrenceGadmLevel[];
  observer: string | null;
  qualityGrade: string | null;
  basisOfRecord: string | null;
  imageUrl: string | null;
  occurrenceUrl: string | null;
}

export interface SpeciesOccurrenceGadmLevel {
  level: string;
  gid: string | null;
  name: string | null;
}

export interface SpeciesOccurrenceMap {
  summary: SpeciesOccurrenceSummary;
  filters: SpeciesOccurrenceFilterOptions;
  points: SpeciesOccurrencePoint[];
}

export interface SpeciesOccurrenceFilterOptions {
  regions: string[];
  basisOfRecord: string[];
}
