import { Module } from '@nestjs/common';
import { NatureReservesController } from './nature-reserves.controller';
import { NatureReservesRepository } from './nature-reserves.repository';
import { NatureReservesService } from './nature-reserves.service';

@Module({ controllers: [NatureReservesController], providers: [NatureReservesService, NatureReservesRepository] })
export class NatureReservesModule {}
