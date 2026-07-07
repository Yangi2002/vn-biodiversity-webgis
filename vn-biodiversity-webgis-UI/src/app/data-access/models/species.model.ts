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
  imageUrl: string | null;
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

export interface SpeciesDetailField {
  key: string;
  label: string;
  value: string | null;
}

export interface SpeciesDetailImage {
  imageOrder: number;
  imageUrl: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  showpicMetadata: SpeciesShowpicMetadata | null;
}

export interface SpeciesShowpicMetadata {
  showpicId: string;
  vietnameseName: string | null;
  latinName: string | null;
  author: string | null;
  sourceImageUrl: string | null;
  thumbnailUrl: string | null;
  imagePath: string | null;
  imageLocalPath: string | null;
  imageMimeType: string | null;
  imageFileSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  fetchStatus: string | null;
  errorMessage: string | null;
  showpicUrl: string | null;
  fetchedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SpeciesTaxonomyNode {
  taxonId: string;
  rank: string;
  canonicalName: string;
  vietnameseName: string | null;
}

export interface SpeciesKeywordImage {
  imageOrder: number;
  imageUrl: string;
  mimeType: string;
}

export interface SpeciesKeywordReference {
  keywordId: string;
  keywordText: string;
  keywordTextInDetail: string;
  sectionName: string | null;
  detailUrl: string;
  keywordUrl: string;
  pageTitle: string | null;
  descriptionText: string | null;
  sourceType: string;
  fetchStatus: string;
  images: SpeciesKeywordImage[];
}

export interface SpeciesDetailResponse {
  sourceTable: string;
  sourceLabel: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  family: string | null;
  order: string | null;
  className: string | null;
  titleBlock: string | null;
  imageUrl: string | null;
  imageMimeType: string | null;
  images: SpeciesDetailImage[];
  taxonomyPath: SpeciesTaxonomyNode[];
  keywords: SpeciesKeywordReference[];
  fields: SpeciesDetailField[];
}
