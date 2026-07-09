import { Controller, Get, Query } from '@nestjs/common';
import type { OccurrenceOverviewQueryDto } from './dto/occurrence-overview-query.dto';
import { OccurrenceService } from './occurrence.service';

@Controller('occurrences')
export class OccurrenceController {
  constructor(private readonly occurrenceService: OccurrenceService) {}

  @Get('map/overview')
  getMapOverview(@Query() query: OccurrenceOverviewQueryDto) {
    return this.occurrenceService.getMapOverview(query);
  }
}
