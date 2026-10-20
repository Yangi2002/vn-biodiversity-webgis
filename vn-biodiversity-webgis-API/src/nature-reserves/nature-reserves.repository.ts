import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  JsonSafeRecord,
  NatureReserveDetail,
  NatureReserveDocumentItem,
  NatureReserveDocumentFilters,
  NatureReserveFilterOptions,
  NatureReserveFilters,
  NatureReserveListItem,
  NatureReserveSort,
  NatureReserveSummary,
} from './types/nature-reserve.type';

interface CountRow { total: bigint | number | null }
type DatabaseRow = Record<string, unknown>;
type SummaryColumn = 'province' | 'socio_economic_region' | 'reserve_type';

const LIST_COLUMNS = `source_id, reserve_code, name, reserve_type, province, district, operating_status, management_agency,
  established_year, total_area_ha, latitude, longitude, representative_image_url, collection_image_count,
  description, geometry, detail_url`;

const SORT_CLAUSES: Record<NatureReserveSort, string> = {
  name: 'name ASC, source_id ASC',
  'area-desc': 'total_area_ha DESC NULLS LAST, name ASC',
  'area-asc': 'total_area_ha ASC NULLS LAST, name ASC',
  'year-desc': 'established_year DESC NULLS LAST, name ASC',
  'year-asc': 'established_year ASC NULLS LAST, name ASC',
};

@Injectable()
export class NatureReservesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: NatureReserveFilters, sort: NatureReserveSort, limit: number, offset: number): Promise<NatureReserveListItem[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.$queryRawUnsafe<DatabaseRow[]>(
      `SELECT ${LIST_COLUMNS} FROM nature_reserves ${where.sql}
       ORDER BY ${SORT_CLAUSES[sort]} LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      ...where.params, limit, offset,
    );
    return rows.map((row) => this.mapListItem(row));
  }

  async count(filters: NatureReserveFilters): Promise<number> {
    const where = this.buildWhere(filters);
    const [row] = await this.prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT count(*) AS total FROM nature_reserves ${where.sql}`,
      ...where.params,
    );
    return this.number(row?.total);
  }

  async mapLayer(): Promise<NatureReserveListItem[]> {
    const rows = await this.prisma.$queryRawUnsafe<DatabaseRow[]>(
      `SELECT ${LIST_COLUMNS} FROM nature_reserves
       WHERE geometry IS NOT NULL OR (latitude IS NOT NULL AND longitude IS NOT NULL)
       ORDER BY name`,
    );
    return rows.map((row) => this.mapListItem(row));
  }

  async filterOptions(): Promise<NatureReserveFilterOptions> {
    const [facets, range] = await Promise.all([
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
        SELECT 'province' AS kind, province AS value FROM nature_reserves WHERE nullif(province, '') IS NOT NULL GROUP BY province
        UNION ALL SELECT 'type', reserve_type FROM nature_reserves WHERE nullif(reserve_type, '') IS NOT NULL GROUP BY reserve_type
        UNION ALL SELECT 'status', operating_status FROM nature_reserves WHERE nullif(operating_status, '') IS NOT NULL GROUP BY operating_status
        ORDER BY kind, value
      `),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
        SELECT min(established_year) AS min_year, max(established_year) AS max_year,
               min(total_area_ha) AS min_area, max(total_area_ha) AS max_area
        FROM nature_reserves
      `),
    ]);
    return {
      provinces: facets.filter((item) => item['kind'] === 'province').map((item) => this.string(item['value'])),
      reserveTypes: facets.filter((item) => item['kind'] === 'type').map((item) => this.string(item['value'])),
      operatingStatuses: facets.filter((item) => item['kind'] === 'status').map((item) => this.string(item['value'])),
      minYear: this.nullableNumber(range[0]?.['min_year']),
      maxYear: this.nullableNumber(range[0]?.['max_year']),
      minAreaHa: this.nullableNumber(range[0]?.['min_area']),
      maxAreaHa: this.nullableNumber(range[0]?.['max_area']),
    };
  }

  async summary(): Promise<NatureReserveSummary> {
    const [totals, provinces, regions, types, periods] = await Promise.all([
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
        SELECT count(*) AS total, coalesce(sum(total_area_ha), 0) AS area,
          count(*) FILTER (WHERE geometry IS NOT NULL) AS with_geometry,
          count(*) FILTER (WHERE representative_image_url IS NOT NULL AND representative_image_url <> '') AS with_images,
          (SELECT count(*) FROM nature_reserve_documents) AS documents,
          (SELECT count(*) FROM nature_reserve_ecosystems) AS ecosystems,
          (SELECT count(*) FROM nature_reserve_species_inventories) AS inventories,
          (SELECT count(*) FROM nature_reserve_genetic_resources) AS genetic_resources
        FROM nature_reserves
      `),
      this.groupSummary('province'),
      this.groupSummary('socio_economic_region'),
      this.groupSummary('reserve_type'),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
        SELECT CASE
          WHEN established_year IS NULL THEN 'Chưa rõ'
          WHEN established_year < 1975 THEN 'Trước 1975'
          WHEN established_year < 1990 THEN '1975-1989'
          WHEN established_year < 2000 THEN '1990-1999'
          WHEN established_year < 2010 THEN '2000-2009'
          ELSE 'Từ 2010' END AS label, count(*) AS count
        FROM nature_reserves GROUP BY 1 ORDER BY min(established_year) NULLS LAST
      `),
    ]);
    const total = totals[0] ?? {};
    return {
      totalReserves: this.number(total['total']),
      totalAreaHa: this.number(total['area']),
      withGeometry: this.number(total['with_geometry']),
      withImages: this.number(total['with_images']),
      documentCount: this.number(total['documents']),
      ecosystemCount: this.number(total['ecosystems']),
      inventoryCount: this.number(total['inventories']),
      geneticResourceCount: this.number(total['genetic_resources']),
      byProvince: provinces.map((row) => this.mapGroup(row)),
      byRegion: regions.map((row) => this.mapGroup(row)),
      byType: types.map((row) => this.mapGroup(row)),
      byEstablishedPeriod: periods.map((row) => ({ label: this.string(row['label']), count: this.number(row['count']) })),
    };
  }

  async findById(sourceId: string): Promise<NatureReserveDetail | null> {
    const rows = await this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserves WHERE source_id = $1 LIMIT 1`, sourceId);
    const row = rows[0];
    if (!row) return null;
    const [documents, ecosystems, inventories, geneticResources, files] = await Promise.all([
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserve_documents WHERE reserve_source_id = $1 ORDER BY issued_date DESC NULLS LAST, title`, sourceId),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserve_ecosystems WHERE reserve_source_id = $1 ORDER BY ecosystem_type, ecosystem_group`, sourceId),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserve_species_inventories WHERE reserve_source_id = $1 ORDER BY publication_date DESC NULLS LAST`, sourceId),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserve_genetic_resources WHERE reserve_source_id = $1 ORDER BY scientific_name, resource_name`, sourceId),
      this.prisma.$queryRawUnsafe<DatabaseRow[]>(`SELECT * FROM nature_reserve_files WHERE reserve_source_id = $1 ORDER BY data_group, file_name`, sourceId),
    ]);
    return {
      ...this.mapListItem(row),
      socioEconomicRegion: this.nullableString(row['socio_economic_region']),
      ward: this.nullableString(row['ward']),
      heritageLevel: this.nullableString(row['heritage_level']),
      heritageClassification: this.nullableString(row['heritage_classification']),
      heritageSubgroup: this.nullableString(row['heritage_subgroup']),
      biodiversityConservationSubgroup: this.nullableString(row['biodiversity_conservation_subgroup']),
      internationalDesignations: this.nullableString(row['international_designations']),
      scope: this.nullableString(row['scope']),
      conservationCriteria: this.nullableString(row['conservation_criteria']),
      establishmentDocumentTitle: this.nullableString(row['establishment_document_title']),
      documentNumber: this.nullableString(row['document_number']),
      issuedDate: this.nullableDate(row['issued_date']),
      issuingAuthority: this.nullableString(row['issuing_authority']),
      coreAreaHa: this.nullableNumber(row['core_area_ha']),
      strictProtectionAreaHa: this.nullableNumber(row['strict_protection_area_ha']),
      ecologicalRestorationAreaHa: this.nullableNumber(row['ecological_restoration_area_ha']),
      administrationServiceAreaHa: this.nullableNumber(row['administration_service_area_ha']),
      bufferAreaHa: this.nullableNumber(row['buffer_area_ha']),
      transitionAreaHa: this.nullableNumber(row['transition_area_ha']),
      boundaryText: this.nullableString(row['boundary_text']),
      sourceCitation: this.nullableString(row['source_citation']),
      planningStatus: this.nullableString(row['planning_status']),
      representativeImageCredit: this.nullableString(row['representative_image_credit']),
      documents: this.jsonSafeRows(documents),
      ecosystems: this.jsonSafeRows(ecosystems),
      speciesInventories: this.jsonSafeRows(inventories),
      geneticResources: this.jsonSafeRows(geneticResources),
      files: this.jsonSafeRows(files),
    };
  }

  async documents(filters: NatureReserveDocumentFilters, limit: number, offset: number) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); clauses.push(sql.replace('?', `$${params.length}`)); };
    if (filters.query) {
      params.push(`%${filters.query}%`);
      const token = `$${params.length}`;
      clauses.push(`(d.title ILIKE ${token} OR d.document_number ILIKE ${token} OR r.name ILIKE ${token})`);
    }
    if (filters.documentType) add('d.document_type = ?', filters.documentType);
    if (filters.issuingAuthority) add('d.issuing_authority = ?', filters.issuingAuthority);
    if (filters.year !== null) add('d.issued_year = ?', filters.year);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
      SELECT d.*, r.name AS reserve_name FROM nature_reserve_documents d
      JOIN nature_reserves r ON r.source_id = d.reserve_source_id
      ${where} ORDER BY d.issued_date DESC NULLS LAST, d.title LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, ...params, limit, offset);
    const [count] = await this.prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT count(*) AS total FROM nature_reserve_documents d JOIN nature_reserves r ON r.source_id = d.reserve_source_id ${where}
    `, ...params);
    return { items: rows.map((row) => this.mapDocument(row)), total: this.number(count?.total) };
  }

  private buildWhere(filters: NatureReserveFilters) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, operator: string, value: unknown) => { params.push(value); clauses.push(`${column} ${operator} $${params.length}`); };
    if (filters.query) { params.push(`%${filters.query}%`); clauses.push(`(name ILIKE $${params.length} OR reserve_code ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    if (filters.province) add('province', '=', filters.province);
    if (filters.reserveType) add('reserve_type', '=', filters.reserveType);
    if (filters.operatingStatus) add('operating_status', '=', filters.operatingStatus);
    if (filters.yearFrom !== null) add('established_year', '>=', filters.yearFrom);
    if (filters.yearTo !== null) add('established_year', '<=', filters.yearTo);
    if (filters.areaMin !== null) add('total_area_ha', '>=', filters.areaMin);
    if (filters.areaMax !== null) add('total_area_ha', '<=', filters.areaMax);
    return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  private mapListItem(row: DatabaseRow): NatureReserveListItem { return {
    sourceId: this.string(row['source_id']), reserveCode: this.string(row['reserve_code']), name: this.string(row['name']), reserveType: this.nullableString(row['reserve_type']),
    province: this.nullableString(row['province']), district: this.nullableString(row['district']), operatingStatus: this.nullableString(row['operating_status']),
    managementAgency: this.nullableString(row['management_agency']), establishedYear: this.nullableNumber(row['established_year']),
    totalAreaHa: this.nullableNumber(row['total_area_ha']), latitude: this.nullableNumber(row['latitude']),
    longitude: this.nullableNumber(row['longitude']), representativeImageUrl: this.nullableString(row['representative_image_url']),
    collectionImageCount: this.number(row['collection_image_count']), description: this.nullableString(row['description']),
    geometry: row['geometry'] ?? null, detailUrl: this.nullableString(row['detail_url']),
  }; }
  private mapDocument(row: DatabaseRow): NatureReserveDocumentItem { return {
    documentId: this.string(row['document_id']), reserveSourceId: this.string(row['reserve_source_id']), reserveName: this.string(row['reserve_name']),
    documentCode: this.nullableString(row['document_code']), title: this.nullableString(row['title']), documentType: this.nullableString(row['document_type']),
    documentNumber: this.nullableString(row['document_number']), issuingAuthority: this.nullableString(row['issuing_authority']),
    issuedYear: this.nullableNumber(row['issued_year']), issuedDate: this.nullableDate(row['issued_date']), fileName: this.nullableString(row['file_name']), fileUrl: this.nullableString(row['file_url']),
  }; }
  private async groupSummary(column: SummaryColumn) { return this.prisma.$queryRawUnsafe<DatabaseRow[]>(`
    SELECT coalesce(nullif(${column}, ''), 'Chưa rõ') AS label, count(*) AS count, coalesce(sum(total_area_ha), 0) AS area
    FROM nature_reserves GROUP BY 1 ORDER BY count DESC, label LIMIT 60`); }
  private mapGroup(row: DatabaseRow) { return { label: this.string(row['label']), count: this.number(row['count']), areaHa: this.number(row['area']) }; }
  private number(value: unknown): number { const result = Number(value ?? 0); return Number.isFinite(result) ? result : 0; }
  private nullableNumber(value: unknown): number | null { return value === null || value === undefined ? null : this.number(value); }
  private string(value: unknown): string { return value === null || value === undefined ? '' : String(value); }
  private nullableString(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
  private nullableDate(value: unknown): string | null { return value instanceof Date ? value.toISOString() : this.nullableString(value); }
  private jsonSafeRows(rows: DatabaseRow[]): JsonSafeRecord[] {
    return rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.jsonValue(value)]),
    ));
  }
  private jsonValue(value: unknown): import('./types/nature-reserve.type').JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.jsonValue(item));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.jsonValue(item)]));
    return String(value);
  }
}
