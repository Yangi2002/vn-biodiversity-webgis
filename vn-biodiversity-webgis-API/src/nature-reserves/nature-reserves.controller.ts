import { Controller, Get, Param, Query } from '@nestjs/common';
import type { NatureReserveDocumentQueryDto, NatureReserveQueryDto } from './dto/nature-reserve-query.dto';
import { NatureReservesService } from './nature-reserves.service';

@Controller('nature-reserves')
export class NatureReservesController {
  constructor(private readonly service: NatureReservesService) {}
  @Get() list(@Query() query: NatureReserveQueryDto) { return this.service.list(query); }
  @Get('map-layer') mapLayer() { return this.service.mapLayer(); }
  @Get('filter-options') filterOptions() { return this.service.filterOptions(); }
  @Get('summary') summary() { return this.service.summary(); }
  @Get('documents') documents(@Query() query: NatureReserveDocumentQueryDto) { return this.service.documents(query); }
  @Get(':sourceId') detail(@Param('sourceId') sourceId: string) { return this.service.detail(sourceId); }
}
