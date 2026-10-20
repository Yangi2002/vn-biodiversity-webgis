export interface NatureReserveFilters {
  query: string;
  province: string;
  reserveType: string;
  operatingStatus: string;
  yearFrom: number | null;
  yearTo: number | null;
  areaMin: number | null;
  areaMax: number | null;
}

export type NatureReserveSort = 'name' | 'area-desc' | 'area-asc' | 'year-desc' | 'year-asc';

export interface NatureReserveDocumentFilters {
  query: string;
  documentType: string;
  issuingAuthority: string;
  year: number | null;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonSafeRecord = Record<string, JsonValue>;

export interface NatureReserveListItem {
  sourceId: string;
  reserveCode: string;
  name: string;
  reserveType: string | null;
  province: string | null;
  district: string | null;
  operatingStatus: string | null;
  managementAgency: string | null;
  establishedYear: number | null;
  totalAreaHa: number | null;
  latitude: number | null;
  longitude: number | null;
  representativeImageUrl: string | null;
  collectionImageCount: number;
  description: string | null;
  geometry: unknown;
  detailUrl: string | null;
}

export interface NatureReserveListResponse {
  items: NatureReserveListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: NatureReserveFilters;
}

export interface NatureReserveFilterOptions {
  provinces: string[];
  reserveTypes: string[];
  operatingStatuses: string[];
  minYear: number | null;
  maxYear: number | null;
  minAreaHa: number | null;
  maxAreaHa: number | null;
}

export interface NatureReserveSummary {
  totalReserves: number;
  totalAreaHa: number;
  withGeometry: number;
  withImages: number;
  documentCount: number;
  ecosystemCount: number;
  inventoryCount: number;
  geneticResourceCount: number;
  byProvince: Array<{ label: string; count: number; areaHa: number }>;
  byRegion: Array<{ label: string; count: number; areaHa: number }>;
  byType: Array<{ label: string; count: number; areaHa: number }>;
  byEstablishedPeriod: Array<{ label: string; count: number }>;
}

export interface NatureReserveDocumentItem {
  documentId: string;
  reserveSourceId: string;
  reserveName: string;
  documentCode: string | null;
  title: string | null;
  documentType: string | null;
  documentNumber: string | null;
  issuingAuthority: string | null;
  issuedYear: number | null;
  issuedDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
}

export interface NatureReserveDetail extends NatureReserveListItem {
  socioEconomicRegion: string | null;
  ward: string | null;
  heritageLevel: string | null;
  heritageClassification: string | null;
  heritageSubgroup: string | null;
  biodiversityConservationSubgroup: string | null;
  internationalDesignations: string | null;
  scope: string | null;
  conservationCriteria: string | null;
  establishmentDocumentTitle: string | null;
  documentNumber: string | null;
  issuedDate: string | null;
  issuingAuthority: string | null;
  coreAreaHa: number | null;
  strictProtectionAreaHa: number | null;
  ecologicalRestorationAreaHa: number | null;
  administrationServiceAreaHa: number | null;
  bufferAreaHa: number | null;
  transitionAreaHa: number | null;
  boundaryText: string | null;
  sourceCitation: string | null;
  planningStatus: string | null;
  representativeImageCredit: string | null;
  documents: JsonSafeRecord[];
  ecosystems: JsonSafeRecord[];
  speciesInventories: JsonSafeRecord[];
  geneticResources: JsonSafeRecord[];
  files: JsonSafeRecord[];
}
