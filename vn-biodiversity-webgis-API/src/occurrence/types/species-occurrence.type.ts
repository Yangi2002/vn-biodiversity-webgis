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
