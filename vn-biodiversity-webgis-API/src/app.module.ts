import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SpeciesModule } from './species/species.module';

@Module({
  imports: [PrismaModule, SpeciesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
