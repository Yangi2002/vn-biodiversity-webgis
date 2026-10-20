export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }; properties?: Record<string, unknown> }>;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type NatureReserveRecord = Record<string, JsonValue>;

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
  geometry: GeoJsonFeatureCollection | null;
  detailUrl: string | null;
}

export interface NatureReserveListResponse {
  items: NatureReserveListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface NatureReserveFilterOptions {
  provinces: string[]; reserveTypes: string[]; operatingStatuses: string[];
  minYear: number | null; maxYear: number | null; minAreaHa: number | null; maxAreaHa: number | null;
}
export interface NatureReserveSummaryGroup { label: string; count: number; areaHa: number }
export interface NatureReserveSummary {
  totalReserves: number; totalAreaHa: number; withGeometry: number; withImages: number;
  documentCount: number; ecosystemCount: number; inventoryCount: number; geneticResourceCount: number;
  byProvince: NatureReserveSummaryGroup[]; byRegion: NatureReserveSummaryGroup[]; byType: NatureReserveSummaryGroup[];
  byEstablishedPeriod: Array<{ label: string; count: number }>;
}
export interface NatureReserveDocument {
  documentId: string; reserveSourceId: string; reserveName: string; documentCode: string | null;
  title: string | null; documentType: string | null; documentNumber: string | null;
  issuingAuthority: string | null; issuedYear: number | null; issuedDate: string | null;
  fileName: string | null; fileUrl: string | null;
}
export interface NatureReserveDetail extends NatureReserveListItem {
  socioEconomicRegion: string | null; ward: string | null; heritageLevel: string | null;
  heritageClassification: string | null; heritageSubgroup: string | null;
  biodiversityConservationSubgroup: string | null; internationalDesignations: string | null;
  scope: string | null; conservationCriteria: string | null; establishmentDocumentTitle: string | null;
  documentNumber: string | null; issuedDate: string | null; issuingAuthority: string | null;
  coreAreaHa: number | null; strictProtectionAreaHa: number | null; ecologicalRestorationAreaHa: number | null;
  administrationServiceAreaHa: number | null; bufferAreaHa: number | null; transitionAreaHa: number | null;
  boundaryText: string | null; sourceCitation: string | null; planningStatus: string | null;
  representativeImageCredit: string | null;
  documents: NatureReserveRecord[];
  ecosystems: NatureReserveRecord[];
  speciesInventories: NatureReserveRecord[];
  geneticResources: NatureReserveRecord[];
  files: NatureReserveRecord[];
}

export interface NatureReserveDocumentResponse {
  items: NatureReserveDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
