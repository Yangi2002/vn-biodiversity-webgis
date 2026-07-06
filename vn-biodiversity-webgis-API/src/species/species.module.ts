import { Module } from '@nestjs/common';
import { SpeciesController } from './species.controller';
import { SpeciesRepository } from './species.repository';
import { SpeciesService } from './species.service';

@Module({
  controllers: [SpeciesController],
  providers: [SpeciesService, SpeciesRepository],
})
export class SpeciesModule {}
