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

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

@Injectable()
export class SpeciesService {
  constructor(private readonly speciesRepository: SpeciesRepository) {}

  async search(queryDto: SpeciesSearchQueryDto): Promise<SpeciesSearchResponse> {
    const query = (queryDto.q ?? '').trim();
    const page = this.parsePositiveNumber(queryDto.page, 1);
    const limit = Math.min(this.parsePositiveNumber(queryDto.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const filters = this.parseFilters(queryDto);

    const [items, total, facets] = await Promise.all([
      this.speciesRepository.search(query, filters, limit, offset),
      this.speciesRepository.count(query, filters),
      this.speciesRepository.facets(query, filters),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
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

  private parseFilters(queryDto: SpeciesSearchQueryDto): SpeciesSearchFilters {
    const sourceTable = (queryDto.sourceTable ?? '').trim();

    return {
      sourceTable: isSpeciesSourceTable(sourceTable) ? sourceTable : '',
      className: (queryDto.className ?? '').trim(),
      order: (queryDto.order ?? '').trim(),
      family: (queryDto.family ?? '').trim(),
      genus: (queryDto.genus ?? '').trim(),
    };
  }
}
