import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LLMService } from './llm.service';
import { LLMProcessor } from './llm.processor';
import { PromptBuilder } from './prompt-builder';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'llm-queue' }),
  ],
  providers: [LLMService, LLMProcessor, PromptBuilder],
  exports: [LLMService],
})
export class LLMModule {}
