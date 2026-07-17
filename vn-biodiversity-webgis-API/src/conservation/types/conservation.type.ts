import type { SpeciesSourceTable } from '../../species/types/species-source.type';

export interface ConservationSummary {
  totalMatchedSpecies: number;
  totalProfiles: number;
  categories: ConservationCategorySummary[];
  sourceGroups: ConservationSourceGroupSummary[];
}

export interface ConservationCategorySummary {
  category: string;
  total: number;
}

export interface ConservationSourceGroupSummary {
  sourceTable: SpeciesSourceTable;
  sourceLabel: string;
  total: number;
}

export interface ConservationCategoryOption {
  category: string;
  label: string;
  severityOrder: number | null;
}

export interface ConservationSpeciesItem {
  sourceTable: SpeciesSourceTable;
  sourceLabel: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  order: string | null;
  className: string | null;
  imageUrl: string | null;
  profileId: string;
  pageUrl: string;
  redlistCategory: string | null;
  redlistCriteria: string | null;
  publishedYear: string | null;
  assessor: string | null;
  contributors: string | null;
  distributionVietnam: string | null;
  habitat: string | null;
  threats: string | null;
  conservationStatus: string | null;
  representativeImageUrl: string | null;
  matchMethod: string;
  confidence: number;
}

export interface ConservationSpeciesResponse {
  items: ConservationSpeciesItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: ConservationSummary;
  categoryOptions: ConservationCategoryOption[];
  observationTerms: ObservationTermOption[];
}

export interface ObservationTermOption {
  termId: string;
  label: string;
  termType: string | null;
  total: number;
}
