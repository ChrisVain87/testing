import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, MaxLength } from 'class-validator';

class ReportDto {
  @IsString()
  creatureId: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('report')
  async report(@Req() req: any, @Body() dto: ReportDto) {
    await this.moderationService.reportCreature(req.user.id, dto.creatureId, dto.reason);
    return { data: null, message: 'Report submitted' };
  }
}
