import { Module } from '@nestjs/common';
import { SpeciesController } from './species.controller';
import { SpeciesRepository } from './species.repository';
import { SpeciesService } from './species.service';
import { FungiSpeciesRepository } from './sources/fungi-species.repository';

@Module({
  controllers: [SpeciesController],
  providers: [SpeciesService, SpeciesRepository, FungiSpeciesRepository],
})
export class SpeciesModule {}
