import { Module } from '@nestjs/common';
import { OccurrenceController } from './occurrence.controller';
import { OccurrenceRepository } from './occurrence.repository';
import { OccurrenceService } from './occurrence.service';

@Module({
  controllers: [OccurrenceController],
  providers: [OccurrenceRepository, OccurrenceService],
})
export class OccurrenceModule {}
