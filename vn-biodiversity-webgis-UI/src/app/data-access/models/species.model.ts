export interface SpeciesSearchItem {
  sourceTable: string;
  sourceLabel: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  order: string | null;
  className: string | null;
  genus: string | null;
  titleBlock: string | null;
  detailUrl: string | null;
  imageUrl: string | null;
  imageSource: string | null;
  imageMimeType: string | null;
}

export interface SpeciesSearchFilters {
  sourceTable: string;
  className: string;
  order: string;
  family: string;
  genus: string;
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
  items: SpeciesSearchItem[];
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
