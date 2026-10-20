import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { NatureReserveDocumentQueryDto, NatureReserveQueryDto } from './dto/nature-reserve-query.dto';
import { NatureReservesRepository } from './nature-reserves.repository';
import type { NatureReserveFilters, NatureReserveSort } from './types/nature-reserve.type';

const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_DOCUMENT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const SORT_OPTIONS = new Set<NatureReserveSort>(['name', 'area-desc', 'area-asc', 'year-desc', 'year-asc']);

@Injectable()
export class NatureReservesService {
  constructor(private readonly repository: NatureReservesRepository) {}

  async list(query: NatureReserveQueryDto) {
    const page = this.positiveInteger(query.page, 1);
    const limit = Math.min(this.positiveInteger(query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const filters = this.reserveFilters(query);
    this.assertRange(filters.yearFrom, filters.yearTo, 'year');
    this.assertRange(filters.areaMin, filters.areaMax, 'area');
    const [items, total] = await Promise.all([
      this.repository.list(filters, this.sort(query.sort), limit, (page - 1) * limit),
      this.repository.count(filters),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), filters };
  }

  mapLayer() { return this.repository.mapLayer(); }
  filterOptions() { return this.repository.filterOptions(); }
  summary() { return this.repository.summary(); }

  async detail(sourceId: string) {
    const result = await this.repository.findById(sourceId.trim());
    if (!result) throw new NotFoundException('Nature reserve was not found.');
    return result;
  }

  async documents(query: NatureReserveDocumentQueryDto) {
    const page = this.positiveInteger(query.page, 1);
    const limit = Math.min(this.positiveInteger(query.limit, DEFAULT_DOCUMENT_PAGE_SIZE), MAX_PAGE_SIZE);
    const filters = { query: (query.q ?? '').trim(), documentType: (query.documentType ?? '').trim(),
      issuingAuthority: (query.issuingAuthority ?? '').trim(), year: this.optionalNumber(query.year) };
    const result = await this.repository.documents(filters, limit, (page - 1) * limit);
    return { ...result, page, limit, totalPages: Math.max(1, Math.ceil(result.total / limit)) };
  }

  private positiveInteger(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) throw new BadRequestException('Invalid pagination value.');
    return Math.floor(parsed);
  }
  private optionalNumber(value: string | undefined): number | null {
    if (!value?.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid numeric filter.');
    return parsed;
  }

  private reserveFilters(query: NatureReserveQueryDto): NatureReserveFilters {
    return {
      query: this.text(query.q),
      province: this.text(query.province),
      reserveType: this.text(query.reserveType),
      operatingStatus: this.text(query.operatingStatus),
      yearFrom: this.optionalNumber(query.yearFrom),
      yearTo: this.optionalNumber(query.yearTo),
      areaMin: this.optionalNumber(query.areaMin),
      areaMax: this.optionalNumber(query.areaMax),
    };
  }

  private sort(value: string | undefined): NatureReserveSort {
    const candidate = this.text(value) || 'name';
    if (!SORT_OPTIONS.has(candidate as NatureReserveSort)) throw new BadRequestException('Invalid sort option.');
    return candidate as NatureReserveSort;
  }

  private text(value: string | undefined): string { return (value ?? '').trim(); }

  private assertRange(min: number | null, max: number | null, label: string): void {
    if (min !== null && max !== null && min > max) throw new BadRequestException(`Invalid ${label} range.`);
  }
}
