export interface StatsDashboard {
  summary: StatsSummary;
  speciesGroups: StatsGroupMetric[];
  occurrencesByYear: StatsYearMetric[];
  occurrencesByRegion: StatsRegionMetric[];
  regionYearBreakdown: StatsRegionYearMetric[];
  regionGroupBreakdown: StatsRegionGroupMetric[];
  groupSpeciesComposition: StatsSpeciesShareMetric[];
  regionSpeciesComposition: StatsSpeciesShareMetric[];
  taxonomyHighlights: StatsTaxonomyMetric[];
  basisOfRecord: StatsNameMetric[];
  dataQuality: StatsDataQuality;
  speciesRanking: StatsSpeciesRanking[];
  reserveBreakdown: StatsReserveMetric[];
  iucnCategories: StatsIucnCategoryMetric[];
  iucnSpecies: StatsIucnSpeciesMetric[];
  iucnGenera: StatsIucnGenusMetric[];
}

export interface StatsIucnCategoryMetric {
  category: string;
  label: string;
  speciesCount: number;
  occurrenceCount: number;
}

export interface StatsIucnSpeciesMetric {
  sourceTable: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  genus: string | null;
  sourceGroup: string;
  sourceGroupLabel: string;
  category: string;
  criteria: string | null;
  occurrenceCount: number;
  detailUrl: string;
}

export interface StatsIucnGenusMetric {
  genus: string;
  category: string;
  sourceGroup: string;
  sourceGroupLabel: string;
  speciesCount: number;
  occurrenceCount: number;
}

export interface StatsReserveMetric {
  sourceId: string;
  name: string;
  reserveType: string | null;
  province: string | null;
  occurrenceCount: number;
  speciesCount: number;
}

export interface StatsSummary {
  totalSpecies: number;
  totalOccurrences: number;
  totalRegions: number;
  earliestObservedYear: number | null;
  latestObservedYear: number | null;
  imageCount: number;
}

export interface StatsGroupMetric {
  key: string;
  label: string;
  speciesCount: number;
  occurrenceCount: number;
}

export interface StatsYearMetric {
  year: number;
  occurrenceCount: number;
  speciesCount: number;
}

export interface StatsRegionMetric {
  region: string;
  occurrenceCount: number;
  speciesCount: number;
}

export interface StatsRegionGroupMetric {
  region: string;
  sourceGroup: string;
  sourceGroupLabel: string;
  occurrenceCount: number;
  speciesCount: number;
}

export interface StatsRegionYearMetric {
  region: string;
  year: number;
  occurrenceCount: number;
  speciesCount: number;
}

export interface StatsTaxonomyMetric {
  rank: string;
  rankLabel: string;
  canonicalName: string;
  vietnameseName: string | null;
  sourceGroup: string;
  sourceGroupLabel: string;
  occurrenceCount: number;
  speciesCount: number;
  regionCount: number;
}

export interface StatsSpeciesShareMetric {
  region: string | null;
  sourceGroup: string;
  sourceGroupLabel: string;
  sourceTable: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  occurrenceCount: number;
  speciesCount: number;
  totalOccurrence: number;
  sharePercent: number;
  detailUrl: string;
}

export interface StatsNameMetric {
  name: string;
  count: number;
}

export interface StatsDataQuality {
  validCoordinates: number;
  geospatialIssues: number;
  missingObservedDate: number;
  withImages: number;
  withoutImages: number;
}

export interface StatsSpeciesRanking {
  sourceTable: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  orderName: string | null;
  sourceGroup: string;
  occurrenceCount: number;
  regionCount: number;
  earliestObservedYear: number | null;
  latestObservedYear: number | null;
  detailUrl: string;
}
