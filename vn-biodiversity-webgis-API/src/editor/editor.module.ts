import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EditorController } from './editor.controller';
import { EditorRepository } from './editor.repository';
import { EditorService } from './editor.service';

@Module({
  imports: [AuthModule],
  controllers: [EditorController],
  providers: [EditorRepository, EditorService],
})
export class EditorModule {}
