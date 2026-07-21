import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DataGovernanceController } from './data-governance.controller';
import { DataGovernanceRepository } from './data-governance.repository';
import { DataGovernanceService } from './data-governance.service';

@Module({
  imports: [AuthModule],
  controllers: [DataGovernanceController],
  providers: [DataGovernanceService, DataGovernanceRepository],
})
export class DataGovernanceModule {}
