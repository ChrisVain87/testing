import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CreaturesController } from './creatures.controller';
import { CreaturesService } from './creatures.service';
import { LLMModule } from '../llm/llm.module';
import { MapModule } from '../map/map.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'llm-queue' }),
    LLMModule,
    MapModule,
  ],
  controllers: [CreaturesController],
  providers: [CreaturesService],
  exports: [CreaturesService],
})
export class CreaturesModule {}
