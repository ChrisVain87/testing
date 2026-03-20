import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { TerrainGenerator } from './terrain-generator';

@Module({
  controllers: [MapController],
  providers: [MapService, TerrainGenerator],
  exports: [MapService],
})
export class MapModule {}
