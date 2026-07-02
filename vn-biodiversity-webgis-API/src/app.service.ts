import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello() {
    return {
      name: 'VN Biodiversity WebGIS API',
      status: 'ok',
    };
  }

  async getHealth() {
    const startedAt = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        api: 'ok',
        database: 'ok',
        startedAt,
      };
    } catch (error) {
      return {
        api: 'ok',
        database: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
        startedAt,
      };
    }
  }
}
