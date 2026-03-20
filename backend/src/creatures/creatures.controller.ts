import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CreaturesService } from './creatures.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCreatureDto } from './dto/create-creature.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('creatures')
@UseGuards(JwtAuthGuard)
export class CreaturesController {
  constructor(private readonly creaturesService: CreaturesService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCreatureDto) {
    const creature = await this.creaturesService.create(req.user.id, dto);
    return { data: creature };
  }

  @Get('me')
  async getMyCreature(@Req() req: any) {
    const creature = await this.creaturesService.findMyCreature(req.user.id);
    return { data: creature };
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.creaturesService.getLeaderboard(Number(page), Math.min(Number(limit), 50));
  }

  @Get('me/memories')
  async getMemories(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.creaturesService.getMemories(req.user.id, Number(page), Math.min(Number(limit), 50));
  }

  @Patch('me/prompt')
  @Throttle({ default: { limit: 3, ttl: 14400000 } }) // 3 per 4h (safety margin)
  async updatePrompt(@Req() req: any, @Body() dto: UpdatePromptDto) {
    const result = await this.creaturesService.updatePrompt(req.user.id, dto);
    return { data: result };
  }

  @Get(':id')
  async getCreature(@Param('id') id: string) {
    const creature = await this.creaturesService.findById(id);
    return { data: creature };
  }
}
