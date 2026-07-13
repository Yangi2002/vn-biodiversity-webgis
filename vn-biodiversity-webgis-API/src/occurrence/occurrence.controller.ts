import { Controller, Get, Param, Query } from '@nestjs/common';
import type { OccurrenceCellDetailQueryDto } from './dto/occurrence-cell-detail-query.dto';
import type { OccurrenceOverviewQueryDto } from './dto/occurrence-overview-query.dto';
import type { SpeciesOccurrenceQueryDto } from './dto/species-occurrence-query.dto';
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

  @Get('species/:sourceTable/:speciesId')
  getSpeciesOccurrences(
    @Param('sourceTable') sourceTable: string,
    @Param('speciesId') speciesId: string,
    @Query() query: SpeciesOccurrenceQueryDto,
  ) {
    return this.occurrenceService.getSpeciesOccurrences(sourceTable, speciesId, query);
  }
}
