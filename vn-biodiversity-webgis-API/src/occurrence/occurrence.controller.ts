import { Controller, Get, Query } from '@nestjs/common';
import type { OccurrenceCellDetailQueryDto } from './dto/occurrence-cell-detail-query.dto';
import type { OccurrenceOverviewQueryDto } from './dto/occurrence-overview-query.dto';
import { OccurrenceService } from './occurrence.service';

@Controller('occurrences')
export class OccurrenceController {
  constructor(private readonly occurrenceService: OccurrenceService) {}

  @Get('map/overview')
  getMapOverview(@Query() query: OccurrenceOverviewQueryDto) {
    return this.occurrenceService.getMapOverview(query);
  }

  // Reserved for the next WebGIS phase: detailed species/taxonomy data per selected grid cell.
  @Get('map/cell-detail')
  getCellDetail(@Query() query: OccurrenceCellDetailQueryDto) {
    return this.occurrenceService.getCellDetail(query);
  }
}
