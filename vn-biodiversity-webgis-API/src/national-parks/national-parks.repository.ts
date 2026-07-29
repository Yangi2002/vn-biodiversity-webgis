import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NationalParkDetail,
  NationalParkListItem,
  NationalParkMapLayer,
  NationalParkSourceSummary,
  NationalParkSummary,
} from './types/national-park.type';

interface NationalParkFilters {
  source: string;
  hasImage: string;
}

interface NationalParkRow {
  park_id: string;
  source: string | null;
  map_url: string | null;
  detail_url: string | null;
  slug: string | null;
  title: string | null;
  map_popup_title: string | null;
  map_popup_excerpt: string | null;
  map_latitude: string | null;
  map_longitude: string | null;
  latitude: string | null;
  longitude: string | null;
  author: string | null;
  thumbnail_url: string | null;
  tom_tat: string | null;
  quyet_dinh_thanh_lap: string | null;
  toa_do_dia_ly: string | null;
  quy_mo_dien_tich: string | null;
  muc_tieu_nhiem_vu: string | null;
  co_quan_cap_quan_ly: string | null;
  ban_quan_ly: string | null;
  vi_tri_dia_ly: string | null;
  da_dang_sinh_hoc: string | null;
  he_thuc_vat: string | null;
  he_dong_vat: string | null;
  hoat_dong_du_lich: string | null;
  du_an_lien_quan: string | null;
  dan_so_trong_vung: string | null;
  nguon_tham_khao: string | null;
  detail_sections_json: string | null;
  content_text: string | null;
  image_urls: string | null;
  image_captions: string | null;
  image_group_id: string | null;
  primary_image_url: string | null;
  primary_image_path: string | null;
  image_count: string | null;
  local_image_paths: string | null;
  image_metadata_json: string | null;
  source_payload: string | null;
}

interface NationalParkCountRow {
  total: bigint | number | null;
}

interface NationalParkSummaryRow {
  total: bigint | number | null;
  with_primary_image: bigint | number | null;
  with_local_images: bigint | number | null;
}

interface NationalParkSourceRow {
  source: string | null;
  total: bigint | number | null;
}

@Injectable()
export class NationalParksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: string,
    filters: NationalParkFilters,
    limit: number,
    offset: number,
  ): Promise<NationalParkListItem[]> {
    const where = this.buildWhereClause(query, filters);
    const rows = await this.prisma.$queryRawUnsafe<NationalParkRow[]>(
      `
      SELECT ${this.listColumns()}
      FROM national_parks_vn
      ${where.sql}
      ORDER BY title NULLS LAST, park_id
      LIMIT $${where.params.length + 1}
      OFFSET $${where.params.length + 2}
      `,
      ...where.params,
      limit,
      offset,
    );

    return rows.map((row) => this.mapListItem(row));
  }

  async count(query: string, filters: NationalParkFilters): Promise<number> {
    const where = this.buildWhereClause(query, filters);
    const [row] = await this.prisma.$queryRawUnsafe<NationalParkCountRow[]>(
      `
      SELECT count(*) AS total
      FROM national_parks_vn
      ${where.sql}
      `,
      ...where.params,
    );

    return this.toNumber(row?.total);
  }

  async summary(): Promise<NationalParkSummary> {
    const [summaryRows, sourceRows] = await Promise.all([
      this.prisma.$queryRaw<NationalParkSummaryRow[]>`
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE primary_image_url IS NOT NULL AND primary_image_url <> '') AS with_primary_image,
          count(*) FILTER (WHERE local_image_paths IS NOT NULL AND local_image_paths <> '') AS with_local_images
        FROM national_parks_vn
      `,
      this.prisma.$queryRaw<NationalParkSourceRow[]>`
        SELECT
          coalesce(nullif(source, ''), 'unknown') AS source,
          count(*) AS total
        FROM national_parks_vn
        GROUP BY coalesce(nullif(source, ''), 'unknown')
        ORDER BY total DESC, source
      `,
    ]);
    const summary = summaryRows[0];

    return {
      total: this.toNumber(summary?.total),
      withPrimaryImage: this.toNumber(summary?.with_primary_image),
      withLocalImages: this.toNumber(summary?.with_local_images),
      sources: sourceRows.map((row): NationalParkSourceSummary => ({
        source: row.source ?? 'unknown',
        total: this.toNumber(row.total),
      })),
    };
  }

  async findById(parkId: string): Promise<NationalParkDetail | null> {
    const rows = await this.prisma.$queryRawUnsafe<NationalParkRow[]>(
      `
      SELECT *
      FROM national_parks_vn
      WHERE park_id = $1
      LIMIT 1
      `,
      parkId,
    );
    const row = rows[0];

    return row ? this.mapDetail(row) : null;
  }

  async mapLayer(limit: number): Promise<NationalParkMapLayer> {
    const [items, total] = await Promise.all([
      this.prisma.$queryRawUnsafe<NationalParkRow[]>(
        `
        SELECT ${this.listColumns()}
        FROM national_parks_vn
        ORDER BY title NULLS LAST, park_id
        LIMIT $1
        `,
        limit,
      ),
      this.prisma.$queryRaw<NationalParkCountRow[]>`
        SELECT count(*) AS total
        FROM national_parks_vn
      `,
    ]);

    return {
      items: items.map((row) => this.mapListItem(row)),
      total: this.toNumber(total[0]?.total),
    };
  }

  private buildWhereClause(query: string, filters: NationalParkFilters): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query) {
      params.push(`%${query}%`);
      clauses.push(`
        (
          title ILIKE $${params.length}
          OR map_popup_title ILIKE $${params.length}
          OR map_popup_excerpt ILIKE $${params.length}
          OR content_text ILIKE $${params.length}
        )
      `);
    }

    if (filters.source) {
      params.push(filters.source);
      clauses.push(`source = $${params.length}`);
    }

    if (filters.hasImage === 'true') {
      clauses.push(`primary_image_url IS NOT NULL AND primary_image_url <> ''`);
    }

    if (filters.hasImage === 'false') {
      clauses.push(`(primary_image_url IS NULL OR primary_image_url = '')`);
    }

    return {
      sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  private listColumns(): string {
    return `
      park_id,
      source,
      map_url,
      detail_url,
      slug,
      title,
      map_popup_title,
      map_popup_excerpt,
      map_latitude,
      map_longitude,
      latitude,
      longitude,
      author,
      thumbnail_url,
      tom_tat,
      quyet_dinh_thanh_lap,
      toa_do_dia_ly,
      quy_mo_dien_tich,
      muc_tieu_nhiem_vu,
      co_quan_cap_quan_ly,
      ban_quan_ly,
      vi_tri_dia_ly,
      da_dang_sinh_hoc,
      he_thuc_vat,
      he_dong_vat,
      hoat_dong_du_lich,
      du_an_lien_quan,
      dan_so_trong_vung,
      nguon_tham_khao,
      detail_sections_json,
      content_text,
      image_urls,
      image_captions,
      image_group_id,
      primary_image_url,
      primary_image_path,
      image_count,
      local_image_paths,
      image_metadata_json,
      source_payload
    `;
  }

  private mapListItem(row: NationalParkRow): NationalParkListItem {
    const mapCoordinate = this.extractRowMapCoordinate(row) ?? this.extractMapCoordinate(this.parseJson(row.source_payload));

    return {
      parkId: row.park_id,
      source: row.source,
      slug: row.slug,
      mapUrl: row.map_url,
      title: row.title,
      mapPopupTitle: row.map_popup_title,
      mapPopupExcerpt: row.map_popup_excerpt,
      thumbnailUrl: row.thumbnail_url,
      primaryImageUrl: row.primary_image_url,
      primaryImagePath: row.primary_image_path,
      imageCount: this.parseNumberText(row.image_count),
      mapLatitude: mapCoordinate.latitude,
      mapLongitude: mapCoordinate.longitude,
      coordinateText: row.toa_do_dia_ly,
      areaText: row.quy_mo_dien_tich,
      managementAgency: row.co_quan_cap_quan_ly,
      detailUrl: row.detail_url,
    };
  }

  private extractRowMapCoordinate(row: NationalParkRow): { latitude: number; longitude: number } | null {
    const candidates = [
      {
        latitude: this.parseCoordinateValue(row.map_latitude),
        longitude: this.parseCoordinateValue(row.map_longitude),
      },
      {
        latitude: this.parseCoordinateValue(row.latitude),
        longitude: this.parseCoordinateValue(row.longitude),
      },
    ];

    for (const candidate of candidates) {
      if (
        candidate.latitude !== null &&
        candidate.longitude !== null &&
        this.isVietnamCoordinate(candidate.latitude, candidate.longitude)
      ) {
        return {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        };
      }
    }

    return null;
  }

  private mapDetail(row: NationalParkRow): NationalParkDetail {
    return {
      ...this.mapListItem(row),
      mapUrl: row.map_url,
      author: row.author,
      summaryText: row.tom_tat,
      establishmentDecision: row.quyet_dinh_thanh_lap,
      objectiveMission: row.muc_tieu_nhiem_vu,
      parentAgency: row.co_quan_cap_quan_ly,
      managementBoard: row.ban_quan_ly,
      geographicLocation: row.vi_tri_dia_ly,
      biodiversity: row.da_dang_sinh_hoc,
      flora: row.he_thuc_vat,
      fauna: row.he_dong_vat,
      tourismActivities: row.hoat_dong_du_lich,
      relatedProjects: row.du_an_lien_quan,
      populationInArea: row.dan_so_trong_vung,
      references: row.nguon_tham_khao,
      detailSections: this.parseJson(row.detail_sections_json),
      contentText: row.content_text,
      imageUrls: this.parseTextArray(row.image_urls),
      imageCaptions: this.parseTextArray(row.image_captions),
      localImagePaths: this.parseTextArray(row.local_image_paths),
      imageMetadata: this.parseJson(row.image_metadata_json),
      sourcePayload: this.parseJson(row.source_payload),
    };
  }

  private parseTextArray(value: string | null): string[] {
    if (!value) {
      return [];
    }

    const parsed = this.parseJson(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }

    return value
      .split(/\r?\n|;\s*|,\s*(?=https?:\/\/|\/|[A-Za-z]:\\)/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private extractMapCoordinate(sourcePayload: unknown): { latitude: number | null; longitude: number | null } {
    if (!sourcePayload || typeof sourcePayload !== 'object') {
      return { latitude: null, longitude: null };
    }

    const payload = sourcePayload as Record<string, unknown>;
    const listRecord = payload['list_record'];
    const markerRecord = payload['marker_record'];
    const candidates = [
      markerRecord && typeof markerRecord === 'object' ? markerRecord : null,
      listRecord && typeof listRecord === 'object' ? listRecord : null,
      payload,
    ].filter((item): item is Record<string, unknown> => Boolean(item));

    for (const candidate of candidates) {
      const latitude = this.parseCoordinateValue(candidate['latitude'] ?? candidate['lat']);
      const longitude = this.parseCoordinateValue(candidate['longitude'] ?? candidate['lng'] ?? candidate['lon']);

      if (latitude !== null && longitude !== null && this.isVietnamCoordinate(latitude, longitude)) {
        return { latitude, longitude };
      }
    }

    return { latitude: null, longitude: null };
  }

  private parseCoordinateValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isVietnamCoordinate(latitude: number, longitude: number): boolean {
    return latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110;
  }

  private parseJson(value: string | null): unknown {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    const candidates = [trimmed];

    if (trimmed.includes(`'"`) || trimmed.includes(`"'`) || trimmed.includes("':")) {
      candidates.push(trimmed.replace(/'/g, '"'));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next normalized candidate.
      }
    }

    return null;
  }

  private parseNumberText(value: string | null): number {
    if (!value) {
      return 0;
    }

    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toNumber(value: bigint | number | null | undefined): number {
    return Number(value ?? 0);
  }
}
