import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { SpeciesSearchQueryDto } from './dto/species-search-query.dto';
import { SpeciesService } from './species.service';

@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get('search')
  search(@Query() query: SpeciesSearchQueryDto) {
    return this.speciesService.search(query);
  }

  @Get('keywords/:keywordId/images/:imageOrder')
  @Header('Cache-Control', 'public, max-age=86400')
  async getKeywordImageByOrder(
    @Param('keywordId') keywordId: string,
    @Param('imageOrder') imageOrder: string,
    @Res() response: Response,
  ) {
    const image = await this.speciesService.getKeywordImageByOrder(keywordId, imageOrder);

    response.type(image.mimeType).send(Buffer.from(image.imageData));
  }

  @Get(':sourceTable/:speciesId')
  getDetail(@Param('sourceTable') sourceTable: string, @Param('speciesId') speciesId: string) {
    return this.speciesService.getDetail(sourceTable, speciesId);
  }

  @Get(':sourceTable/:speciesId/image')
  @Header('Cache-Control', 'public, max-age=86400')
  async getPrimaryImage(
    @Param('sourceTable') sourceTable: string,
    @Param('speciesId') speciesId: string,
    @Res() response: Response,
  ) {
    const image = await this.speciesService.getPrimaryImage(sourceTable, speciesId);

    response.type(image.mimeType).send(Buffer.from(image.imageData));
  }

  @Get(':sourceTable/:speciesId/showpic-images/:imageOrder')
  @Header('Cache-Control', 'public, max-age=86400')
  async getShowpicImageByOrder(
    @Param('sourceTable') sourceTable: string,
    @Param('speciesId') speciesId: string,
    @Param('imageOrder') imageOrder: string,
    @Res() response: Response,
  ) {
    const image = await this.speciesService.getShowpicImageByOrder(sourceTable, speciesId, imageOrder);

    response.type(image.mimeType).send(Buffer.from(image.imageData));
  }

  @Get(':sourceTable/:speciesId/images/:imageOrder')
  @Header('Cache-Control', 'public, max-age=86400')
  async getImageByOrder(
    @Param('sourceTable') sourceTable: string,
    @Param('speciesId') speciesId: string,
    @Param('imageOrder') imageOrder: string,
    @Res() response: Response,
  ) {
    const image = await this.speciesService.getImageByOrder(sourceTable, speciesId, imageOrder);

    response.type(image.mimeType).send(Buffer.from(image.imageData));
  }
}
