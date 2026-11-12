import { Module } from '@nestjs/common';
import { AssistantBotService } from './assistantbot.service';

import { AuthModule } from '../auth/auth.module';
import { AssistantBotController } from './assistantbot.controller';

@Module({ imports: [AuthModule], controllers: [AssistantBotController], providers: [AssistantBotService], exports: [AssistantBotService] })
export class AssistantBotModule {}
