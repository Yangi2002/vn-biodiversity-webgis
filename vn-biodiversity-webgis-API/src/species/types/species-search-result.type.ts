import type { SpeciesSourceTable } from './species-source.type';

export interface SpeciesSearchResult {
  sourceTable: SpeciesSourceTable;
  sourceLabel: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  order: string | null;
  className: string | null;
  genus: string | null;
  titleBlock: string | null;
  imageUrl: string | null;
  imageMimeType: string | null;
}

export interface SpeciesSearchFilters {
  sourceTable: SpeciesSourceTable | '';
  className: string;
  order: string;
  family: string;
  genus: string;
  taxonId: string;
}

export interface SpeciesFacetItem {
  value: string;
  label: string;
  count: number;
}

export interface SpeciesSearchFacets {
  sourceTables: SpeciesFacetItem[];
  classNames: SpeciesFacetItem[];
  orders: SpeciesFacetItem[];
  families: SpeciesFacetItem[];
  genera: SpeciesFacetItem[];
}

export interface SpeciesSearchResponse {
  items: SpeciesSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  query: string;
  filters: SpeciesSearchFilters;
  facets: SpeciesSearchFacets;
}

export interface SpeciesImageResult {
  imageData: Uint8Array;
  mimeType: string;
}
