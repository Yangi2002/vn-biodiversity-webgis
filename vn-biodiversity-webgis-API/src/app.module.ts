import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SpeciesModule } from './species/species.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { OccurrenceModule } from './occurrence/occurrence.module';
import { StatsModule } from './stats/stats.module';
import { ConservationModule } from './conservation/conservation.module';

@Module({
  imports: [PrismaModule, SpeciesModule, TaxonomyModule, OccurrenceModule, StatsModule, ConservationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
