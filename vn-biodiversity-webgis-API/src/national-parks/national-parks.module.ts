import { Module } from '@nestjs/common';
import { NationalParksController } from './national-parks.controller';
import { NationalParksRepository } from './national-parks.repository';
import { NationalParksService } from './national-parks.service';

@Module({
  controllers: [NationalParksController],
  providers: [NationalParksService, NationalParksRepository],
})
export class NationalParksModule {}
