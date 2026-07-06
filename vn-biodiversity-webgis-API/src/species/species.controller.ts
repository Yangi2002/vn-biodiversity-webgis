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
}
