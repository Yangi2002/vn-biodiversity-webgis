import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConservationController } from './conservation.controller';
import { ConservationRepository } from './conservation.repository';
import { ConservationService } from './conservation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConservationController],
  providers: [ConservationRepository, ConservationService],
})
export class ConservationModule {}
