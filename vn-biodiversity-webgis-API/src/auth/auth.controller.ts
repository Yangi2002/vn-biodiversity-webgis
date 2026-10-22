import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Permissions } from './decorators/permissions.decorator';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import type { AuthTokenPayload } from './types/auth-user.type';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.currentUser(request.user!);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(request.user!, body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user!);
  }

  @Get('permission-matrix')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('roles.manage')
  permissionMatrix() {
    return this.authService.permissionMatrix();
  }

  @Patch('permission-matrix/:roleCode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('roles.manage')
  updateRolePermissions(
    @Param('roleCode') roleCode: string,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    return this.authService.updateRolePermissions(roleCode, body.permissions);
  }
}
