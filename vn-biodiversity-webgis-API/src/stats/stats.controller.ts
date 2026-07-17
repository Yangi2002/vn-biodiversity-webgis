import { Controller, Get, Query } from '@nestjs/common';
import type { StatsDashboardQueryDto } from './dto/stats-query.dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('summary')
  getSummary(@Query() query: StatsDashboardQueryDto) {
    return this.statsService.getSummary(query);
  }

  @Get('dashboard')
  getDashboard(@Query() query: StatsDashboardQueryDto) {
    return this.statsService.getDashboard(query);
  }
}
