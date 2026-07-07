import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SpeciesModule } from './species/species.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [PrismaModule, SpeciesModule, TaxonomyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
