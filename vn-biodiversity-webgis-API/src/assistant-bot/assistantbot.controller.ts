import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssistantBotService } from './assistantbot.service';
import type { AssistantBotAnswer } from './assistantbot.service';

@Controller('assistant-bot')
@UseGuards(JwtAuthGuard)
export class AssistantBotController {
  constructor(private readonly service: AssistantBotService) {}
  @Post('answer')
  answer(@Body() body: { question?: string } | undefined): Promise<AssistantBotAnswer> {
    return this.service.answer(body?.question ?? '');
  }
}
