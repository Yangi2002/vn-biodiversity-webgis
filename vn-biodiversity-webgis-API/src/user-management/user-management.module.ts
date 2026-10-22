import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserManagementController } from './user-management.controller';
import { UserManagementRepository } from './user-management.repository';
import { UserManagementService } from './user-management.service';

@Module({
  imports: [AuthModule],
  controllers: [UserManagementController],
  providers: [UserManagementService, UserManagementRepository],
})
export class UserManagementModule {}
