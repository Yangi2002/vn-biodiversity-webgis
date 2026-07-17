import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SpeciesSearchQueryDto } from './dto/species-search-query.dto';
import { SpeciesRepository } from './species.repository';
import { isSpeciesSourceTable } from './types/species-source.type';
import type {
  SpeciesImageResult,
  SpeciesSearchFilters,
  SpeciesSearchResponse,
} from './types/species-search-result.type';
import type { SpeciesDetailResult } from './types/species-detail-result.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

@Injectable()
export class SpeciesService {
  private readonly searchCache = new TtlCache<SpeciesSearchResponse>(120_000, 120);
  private readonly detailCache = new TtlCache<SpeciesDetailResult>(600_000, 500);

  constructor(private readonly speciesRepository: SpeciesRepository) {}

  async search(queryDto: SpeciesSearchQueryDto): Promise<SpeciesSearchResponse> {
    const query = (queryDto.q ?? '').trim();
    const page = this.parsePositiveNumber(queryDto.page, 1);
    const limit = Math.min(this.parsePositiveNumber(queryDto.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const filters = this.parseFilters(queryDto);
    const cacheKey = stableCacheKey('species:search', { filters, limit, page, query });
    const cachedResponse = this.searchCache.get(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const [items, total, facets] = await Promise.all([
      this.speciesRepository.search(query, filters, limit, offset),
      this.speciesRepository.count(query, filters),
      this.speciesRepository.facets(query, filters),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const response = {
      items,
      total,
      page,
      limit,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      query,
      filters,
      facets,
    };

    this.searchCache.set(cacheKey, response);
    return response;
  }

  async getPrimaryImage(sourceTable: string, speciesId: string): Promise<SpeciesImageResult> {
    if (!isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const image = await this.speciesRepository.findPrimaryImage(sourceTable, speciesId);

    if (!image) {
      throw new NotFoundException('Species image was not found.');
    }

    return image;
  }

  async getImageByOrder(
    sourceTable: string,
    speciesId: string,
    imageOrderValue: string,
  ): Promise<SpeciesImageResult> {
    if (!isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const imageOrder = this.parsePositiveNumber(imageOrderValue, 0);

    if (imageOrder < 1) {
      throw new BadRequestException('Invalid species image order.');
    }

    const image = await this.speciesRepository.findImageByOrder(sourceTable, speciesId, imageOrder);

    if (!image) {
      throw new NotFoundException('Species image was not found.');
    }

    return image;
  }

  async getShowpicImageByOrder(
    sourceTable: string,
    speciesId: string,
    imageOrderValue: string,
  ): Promise<SpeciesImageResult> {
    if (!isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const imageOrder = this.parsePositiveNumber(imageOrderValue, 0);

    if (imageOrder < 1) {
      throw new BadRequestException('Invalid species showpic image order.');
    }

    const image = await this.speciesRepository.findShowpicImageByOrder(sourceTable, speciesId, imageOrder);

    if (!image) {
      throw new NotFoundException('Species showpic image was not found.');
    }

    return image;
  }

  async getKeywordImageByOrder(keywordId: string, imageOrderValue: string): Promise<SpeciesImageResult> {
    const imageOrder = this.parsePositiveNumber(imageOrderValue, 0);

    if (!keywordId || imageOrder < 1) {
      throw new BadRequestException('Invalid keyword image request.');
    }

    const image = await this.speciesRepository.findKeywordImageByOrder(keywordId, imageOrder);

    if (!image) {
      throw new NotFoundException('Keyword image was not found.');
    }

    return image;
  }

  async getDetail(sourceTable: string, speciesId: string): Promise<SpeciesDetailResult> {
    if (!isSpeciesSourceTable(sourceTable)) {
      throw new BadRequestException('Invalid species source table.');
    }

    const cacheKey = stableCacheKey('species:detail', { sourceTable, speciesId });
    const cachedDetail = this.detailCache.get(cacheKey);

    if (cachedDetail) {
      return cachedDetail;
    }

    const detail = await this.speciesRepository.findDetail(sourceTable, speciesId);

    if (!detail) {
      throw new NotFoundException('Species detail was not found.');
    }

    this.detailCache.set(cacheKey, detail);
    return detail;
  }

  private parsePositiveNumber(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private parseFilters(queryDto: SpeciesSearchQueryDto): SpeciesSearchFilters {
    const sourceTable = (queryDto.sourceTable ?? '').trim();

    return {
      sourceTable: isSpeciesSourceTable(sourceTable) ? sourceTable : '',
      className: (queryDto.className ?? '').trim(),
      order: (queryDto.order ?? '').trim(),
      family: (queryDto.family ?? '').trim(),
      genus: (queryDto.genus ?? '').trim(),
      taxonId: this.parseTaxonId(queryDto.taxonId),
    };
  }

  private parseTaxonId(value: string | undefined): string {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : '';
  }
}
