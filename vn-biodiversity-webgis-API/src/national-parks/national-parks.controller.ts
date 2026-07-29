import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { NationalParkQueryDto } from './dto/national-park-query.dto';
import { NationalParksService } from './national-parks.service';

@Controller('national-parks')
export class NationalParksController {
  constructor(private readonly nationalParksService: NationalParksService) {}

  @Get()
  list(@Query() query: NationalParkQueryDto) {
    return this.nationalParksService.list(query);
  }

  @Get('summary')
  summary() {
    return this.nationalParksService.summary();
  }

  @Get('map-layer')
  mapLayer() {
    return this.nationalParksService.mapLayer();
  }

  @Get(':parkId/images/:imageIndex')
  @Header('Cache-Control', 'public, max-age=86400')
  async getLocalImage(
    @Param('parkId') parkId: string,
    @Param('imageIndex') imageIndex: string,
    @Res() response: Response,
  ) {
    const image = await this.nationalParksService.getLocalImage(parkId, imageIndex);

    return response.type(image.mimeType).sendFile(image.filePath);
  }

  @Get(':parkId')
  getDetail(@Param('parkId') parkId: string) {
    return this.nationalParksService.getDetail(parkId);
  }
}
