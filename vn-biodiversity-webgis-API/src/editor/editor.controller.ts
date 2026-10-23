import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthTokenPayload } from '../auth/types/auth-user.type';
import { EditorService } from './editor.service';
import type {
  EditorChangeRequest,
  EditorImportRequest,
  EditorImportResult,
  EditorSpeciesDraft,
  EditorValidationRequest,
  EditorValidationResult,
} from './editor.types';

interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

@Controller('editor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EditorController {
  constructor(private readonly service: EditorService) {}

  @Get('requests')
  @Permissions('species.view.full')
  listOwnRequests(@Req() request: AuthenticatedRequest): Promise<EditorChangeRequest[]> {
    return this.service.listOwnRequests(request.user!.sub);
  }

  @Post('validate')
  @Permissions('species.view.full')
  validateSpecies(@Body() body: EditorValidationRequest): Promise<EditorValidationResult> {
    return this.service.validateSpecies(body);
  }

  @Post('species')
  @Permissions('species.create')
  createSpecies(
    @Req() request: AuthenticatedRequest,
    @Body() body: EditorSpeciesDraft,
  ): Promise<EditorChangeRequest> {
    return this.service.createSpecies(request.user!.sub, body);
  }

  @Put('species/:sourceTable/:speciesId')
  @Permissions('species.update')
  updateSpecies(
    @Req() request: AuthenticatedRequest,
    @Param('sourceTable') sourceTable: string,
    @Param('speciesId') speciesId: string,
    @Body() body: EditorSpeciesDraft,
  ): Promise<EditorChangeRequest> {
    return this.service.updateSpecies(request.user!.sub, sourceTable, speciesId, body);
  }

  @Post('import')
  @Permissions('data.import')
  importSpecies(
    @Req() request: AuthenticatedRequest,
    @Body() body: EditorImportRequest,
  ): Promise<EditorImportResult> {
    return this.service.importSpecies(request.user!.sub, body);
  }
}
