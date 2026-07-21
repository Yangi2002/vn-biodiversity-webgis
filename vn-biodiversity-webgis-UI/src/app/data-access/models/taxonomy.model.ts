export interface TaxonomyFacetItem {
  value: string;
  label: string;
  count: number;
}

export interface TaxonomySearchItem {
  taxonId: string;
  rank: string;
  rankLabel: string;
  canonicalName: string;
  vietnameseName: string | null;
  parentTaxonId: string | null;
  taxonomicStatus: 'accepted';
  path: string[];
  speciesCount: number;
  childCount: number;
  representativeImage: TaxonomyRepresentativeImage | null;
}

export interface TaxonomyRepresentativeImage {
  sourceTable: string;
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  imageOrder: number;
  imageUrl: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  metadata: TaxonomyRepresentativeImageMetadata | null;
}

export interface TaxonomyRepresentativeImageMetadata {
  showpicId: string;
  vietnameseName: string | null;
  latinName: string | null;
  author: string | null;
  sourceImageUrl: string | null;
  thumbnailUrl: string | null;
  imageMimeType: string | null;
  imageFileSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  fetchStatus: string | null;
  errorMessage: string | null;
  showpicUrl: string | null;
}

export interface TaxonomySearchResponse {
  items: TaxonomySearchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
  rank: string;
  facets: {
    ranks: TaxonomyFacetItem[];
  };
}

export interface TaxonomyTreeNode {
  taxonId: string;
  rank: string;
  rankLabel: string;
  canonicalName: string;
  vietnameseName?: string | null;
  speciesCount?: number;
  childCount?: number;
  isHighlighted?: boolean;
  children?: TaxonomyTreeNode[];
}
