import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { MapService } from './map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('chunks/:chunkX/:chunkY')
  async getChunk(
    @Param('chunkX', ParseIntPipe) chunkX: number,
    @Param('chunkY', ParseIntPipe) chunkY: number,
  ) {
    const chunk = await this.mapService.getChunk(chunkX, chunkY);
    return { data: chunk };
  }

  @Post('chunks/batch')
  async getChunksBatch(@Body() body: { chunkXs: number[]; chunkYs: number[] }) {
    const chunks = await this.mapService.getChunks(body.chunkXs, body.chunkYs);
    return { data: chunks };
  }

  @Get('biomes/top')
  async getTopBiomes(@Query('limit') limit = 20) {
    const biomes = await this.mapService.getTopBiomes(Number(limit));
    return { data: biomes };
  }
}
