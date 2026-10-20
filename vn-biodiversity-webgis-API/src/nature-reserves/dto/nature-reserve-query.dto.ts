export interface NatureReserveQueryDto {
  q?: string;
  province?: string;
  reserveType?: string;
  operatingStatus?: string;
  yearFrom?: string;
  yearTo?: string;
  areaMin?: string;
  areaMax?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

export interface NatureReserveDocumentQueryDto {
  q?: string;
  documentType?: string;
  issuingAuthority?: string;
  year?: string;
  page?: string;
  limit?: string;
}
