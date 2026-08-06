import { existsSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { stableCacheKey, TtlCache } from '../common/utils/ttl-cache.util';
import type { NationalParkQueryDto } from './dto/national-park-query.dto';
import { NationalParksRepository } from './national-parks.repository';
import type {
  NationalParkDetail,
  NationalParkListResponse,
  NationalParkLocalImage,
  NationalParkMapLayer,
  NationalParkSummary,
} from './types/national-park.type';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MAP_LAYER_LIMIT = 500;

@Injectable()
export class NationalParksService {
  private readonly listCache = new TtlCache<NationalParkListResponse>(120_000, 120);
  private readonly summaryCache = new TtlCache<NationalParkSummary>(300_000, 10);
  private readonly detailCache = new TtlCache<NationalParkDetail | null>(600_000, 200);
  private readonly mapLayerCache = new TtlCache<NationalParkMapLayer>(300_000, 10);
  private readonly imageRoots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '..', '..'),
    resolve('D:/Duong/VNCreaturesDatabase'),
  ];

  constructor(private readonly nationalParksRepository: NationalParksRepository) {}

  async list(queryDto: NationalParkQueryDto): Promise<NationalParkListResponse> {
    const query = (queryDto.q ?? '').trim();
    const page = this.parsePositiveNumber(queryDto.page, 1);
    const limit = Math.min(this.parsePositiveNumber(queryDto.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const filters = {
      source: (queryDto.source ?? '').trim(),
      hasImage: this.parseHasImage(queryDto.hasImage),
    };
    const cacheKey = stableCacheKey('national-parks:list', { filters, limit, page, query });

    return this.listCache.getOrSet(cacheKey, async () => {
      const [items, total] = await Promise.all([
        this.nationalParksRepository.list(query, filters, limit, offset),
        this.nationalParksRepository.count(query, filters),
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
      };
    });
  }

  summary(): Promise<NationalParkSummary> {
    return this.summaryCache.getOrSet('national-parks:summary', () => this.nationalParksRepository.summary());
  }

  mapLayer(): Promise<NationalParkMapLayer> {
    return this.mapLayerCache.getOrSet('national-parks:map-layer', () =>
      this.nationalParksRepository.mapLayer(MAP_LAYER_LIMIT),
    );
  }

  async getDetail(parkId: string): Promise<NationalParkDetail> {
  const parsedParkId = parkId.trim();

  if (!parsedParkId) {
    throw new BadRequestException('Invalid national park id.');
  }

  const cacheKey = stableCacheKey('national-parks:detail', {
    parkId: parsedParkId,
  });

  const detail = await this.detailCache.getOrSet(cacheKey, async () => {
    const result =
      await this.nationalParksRepository.findById(parsedParkId);

    if (!result) {
      return null;
    }

    return this.normalizeDetailImages(result);
  });

  if (!detail) {
    throw new NotFoundException('National park was not found.');
  }

  return detail;
}

private normalizeDetailImages(
  detail: NationalParkDetail,
): NationalParkDetail {
  const remoteImageUrls = this.uniqueImageUrls(
    detail.imageUrls ?? [],
  );

  const validLocalImagePaths = (detail.localImagePaths ?? [])
    .filter((filePath) => Boolean(this.resolveImagePath(filePath)));

  return {
    ...detail,
    imageUrls: remoteImageUrls,
    localImagePaths: validLocalImagePaths,
  };
}

private uniqueImageUrls(
  imageUrls: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawUrl of imageUrls) {
    const url = rawUrl?.trim();

    if (!url || !this.isRemoteImageUrl(url)) {
      continue;
    }

    const key = url
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(url);
  }

  return result;
}

private isRemoteImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

  async getLocalImage(parkId: string, imageIndexValue: string): Promise<NationalParkLocalImage> {
    const imageIndex = this.parsePositiveNumber(imageIndexValue, 0);

    if (imageIndex < 1) {
      throw new BadRequestException('Invalid national park image index.');
    }

    const detail = await this.getDetail(parkId);
    const filePath = detail.localImagePaths[imageIndex - 1];

    if (!filePath) {
      throw new NotFoundException('National park image was not found.');
    }

    const resolvedPath = this.resolveImagePath(filePath);

    if (!resolvedPath) {
      throw new NotFoundException('National park image file was not found.');
    }

    return {
      filePath: resolvedPath,
      mimeType: this.detectMimeType(resolvedPath),
    };
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

  private parseHasImage(value: string | undefined): string {
    const parsed = value?.trim().toLowerCase();

    if (!parsed || parsed === 'all') {
      return '';
    }

    if (parsed === 'true' || parsed === 'false') {
      return parsed;
    }

    throw new BadRequestException('Invalid hasImage filter.');
  }

  private detectMimeType(filePath: string): string {
    const extension = extname(filePath).toLowerCase();

    if (extension === '.png') {
      return 'image/png';
    }

    if (extension === '.webp') {
      return 'image/webp';
    }

    if (extension === '.gif') {
      return 'image/gif';
    }

    return 'image/jpeg';
  }

  private resolveImagePath(filePath: string): string | null {
    const candidates = isAbsolute(filePath)
      ? [resolve(filePath)]
      : this.imageRoots.map((root) => resolve(root, filePath));

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }
}
