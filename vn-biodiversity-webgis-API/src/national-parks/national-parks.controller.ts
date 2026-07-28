import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get(':parkId')
  getDetail(@Param('parkId') parkId: string) {
    return this.nationalParksService.getDetail(parkId);
  }
}
