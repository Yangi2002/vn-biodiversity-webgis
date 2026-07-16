import { Controller, Get, Query } from '@nestjs/common';
import { ConservationService } from './conservation.service';
import type { ConservationQueryDto } from './dto/conservation-query.dto';

@Controller('conservation')
export class ConservationController {
  constructor(private readonly conservationService: ConservationService) {}

  @Get('endangered-species')
  endangeredSpecies(@Query() query: ConservationQueryDto) {
    return this.conservationService.findEndangeredSpecies(query);
  }
}
