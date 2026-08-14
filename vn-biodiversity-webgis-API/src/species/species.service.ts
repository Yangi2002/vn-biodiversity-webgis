import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SpeciesSearchQueryDto } from './dto/species-search-query.dto';
import { SpeciesRepository } from './species.repository';
import { isSpeciesSourceTable } from './types/species-source.type';
import type {
  SpeciesImageResult,
  SpeciesSearchFacets,
  SpeciesSearchResult,
  SpeciesSearchFilters,
  SpeciesSearchResponse,
} from './types/species-search-result.type';
import type { SpeciesDetailResult } from './types/species-detail-result.type';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

interface SpeciesSearchMeta {
  total: number;
  facets: SpeciesSearchFacets;
}

@Injectable()
export class SpeciesService {
  private readonly searchCache = new TtlCache<SpeciesSearchResponse>(60_000, 240);
  private readonly searchMetaCache = new TtlCache<SpeciesSearchMeta>(120_000, 120);

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

    const metaCacheKey = stableCacheKey('species:search-meta', { filters, query });
    const [rawItems, meta] = await Promise.all([
      this.speciesRepository.search(query, filters, limit, offset),
      this.searchMetaCache.getOrSet(metaCacheKey, async () => {
        const [total, facets] = await Promise.all([
          this.speciesRepository.count(query, filters),
          this.speciesRepository.facets(query, filters),
        ]);

        return { total, facets };
      }),
    ]);
    const items = this.mergeDuplicateSearchItems(rawItems);
    const totalPages = Math.max(1, Math.ceil(meta.total / limit));

    const response = {
      items,
      total: meta.total,
      page,
      limit,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      query,
      filters,
      facets: meta.facets,
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

    const detail = await this.speciesRepository.findDetail(sourceTable, speciesId);

    if (!detail) {
      throw new NotFoundException('Species detail was not found.');
    }

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

  private mergeDuplicateSearchItems(items: SpeciesSearchResult[]): SpeciesSearchResult[] {
    const mergedItems: SpeciesSearchResult[] = [];
    const itemByDuplicateKey = new Map<string, SpeciesSearchResult>();

    for (const item of items) {
      const duplicateKey = this.duplicateSearchKey(item);

      if (!duplicateKey) {
        mergedItems.push(item);
        continue;
      }

      const existingItem = itemByDuplicateKey.get(duplicateKey);

      if (!existingItem) {
        itemByDuplicateKey.set(duplicateKey, item);
        mergedItems.push(item);
        continue;
      }

      this.mergeSearchItemData(existingItem, item);
    }

    return mergedItems;
  }

  private duplicateSearchKey(item: SpeciesSearchResult): string {
    const vietnameseName = this.normalizeDuplicateText(item.vietnameseName);

    if (vietnameseName) {
      return `${item.sourceTable}:${vietnameseName}`;
    }

    const scientificName = this.normalizeScientificName(item.scientificName);
    return scientificName ? `${item.sourceTable}:${scientificName}` : '';
  }

  private mergeSearchItemData(target: SpeciesSearchResult, duplicate: SpeciesSearchResult): void {
    target.imageUrl ??= duplicate.imageUrl;
    target.imageMimeType ??= duplicate.imageMimeType;
    target.family ??= duplicate.family;
    target.order ??= duplicate.order;
    target.className ??= duplicate.className;
    target.genus ??= duplicate.genus;

    const duplicateScientificName = duplicate.scientificName?.trim();

    if (
      duplicateScientificName &&
      target.scientificName?.trim() &&
      this.normalizeScientificName(target.scientificName) !== this.normalizeScientificName(duplicateScientificName)
    ) {
      const synonymLine = `Tên khoa học khác: ${duplicateScientificName}`;
      target.titleBlock = target.titleBlock?.includes(synonymLine)
        ? target.titleBlock
        : [target.titleBlock, synonymLine].filter(Boolean).join('\n');
    }
  }

  private normalizeDuplicateText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private normalizeScientificName(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[,.;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private parseFilters(queryDto: SpeciesSearchQueryDto): SpeciesSearchFilters {
    const sourceTable = (queryDto.sourceTable ?? '').trim();

    return {
      sourceTable: isSpeciesSourceTable(sourceTable) ? sourceTable : '',
      kingdom: (queryDto.kingdom ?? '').trim(),
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
