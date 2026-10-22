import { Body, Controller, Get, Param, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthTokenPayload } from '../auth/types/auth-user.type';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserManagementService } from './user-management.service';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('users.manage')
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Get()
  list(@Query('q') search?: string) {
    return this.service.list(search);
  }

  @Patch(':userId/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    return this.service.updateStatus(request.user!.sub, userId, body.isActive);
  }

  @Put(':userId/role')
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.service.updateRole(request.user!.sub, userId, body.role);
  }
}
