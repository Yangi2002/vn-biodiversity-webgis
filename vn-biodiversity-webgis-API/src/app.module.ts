import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SpeciesModule } from './species/species.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { OccurrenceModule } from './occurrence/occurrence.module';
import { StatsModule } from './stats/stats.module';
import { ConservationModule } from './conservation/conservation.module';
import { AuthModule } from './auth/auth.module';
import { DataGovernanceModule } from './data-governance/data-governance.module';
import { NationalParksModule } from './national-parks/national-parks.module';
import { NatureReservesModule } from './nature-reserves/nature-reserves.module';
import { UserManagementModule } from './user-management/user-management.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SpeciesModule,
    TaxonomyModule,
    OccurrenceModule,
    StatsModule,
    ConservationModule,
    NationalParksModule,
    NatureReservesModule,
    DataGovernanceModule,
    UserManagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
