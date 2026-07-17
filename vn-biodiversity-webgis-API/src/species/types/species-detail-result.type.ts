import type { SpeciesSourceTable } from './species-source.type';

export interface SpeciesDetailField {
  key: string;
  label: string;
  value: string | null;
}

export interface SpeciesDetailImage {
  imageOrder: number;
  imageUrl: string;
  showpicImageUrl: string | null;
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

export interface SpeciesConservationTerm {
  termId: string;
  termText: string;
  termType: string;
  categoryCode: string | null;
  criteriaCode: string | null;
  severityOrder: number | null;
  sourceField: string | null;
  matchedText: string | null;
  context: string | null;
}

export interface SpeciesVnRedListProfile {
  profileId: string;
  pageUrl: string;
  scientificName: string | null;
  vietnameseName: string | null;
  pageTitle: string | null;
  redlistCategory: string | null;
  redlistCriteria: string | null;
  publishedYear: string | null;
  assessor: string | null;
  contributors: string | null;
  distributionVietnam: string | null;
  distributionWorld: string | null;
  habitat: string | null;
  threats: string | null;
  conservationStatus: string | null;
  conservationMeasuresExisting: string | null;
  conservationMeasuresProposed: string | null;
  representativeImageUrl: string | null;
  matchMethod: string | null;
  confidence: number | null;
}

export interface SpeciesConservationSummary {
  vnRedListProfile: SpeciesVnRedListProfile | null;
  terms: SpeciesConservationTerm[];
  highestRiskCategory: string | null;
  isSensitiveOccurrence: boolean;
}

export interface SpeciesDetailResult {
  sourceTable: SpeciesSourceTable;
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
  conservation: SpeciesConservationSummary;
  fields: SpeciesDetailField[];
}
