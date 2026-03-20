import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async reportCreature(reporterId: string, creatureId: string, reason: string) {
    const creature = await this.prisma.creature.findUnique({
      where: { id: creatureId },
      select: { ownerId: true },
    });

    if (!creature) return;

    await this.prisma.moderationReport.create({
      data: {
        reporterId,
        reportedUserId: creature.ownerId,
        reason,
      },
    });

    // Auto-flag if multiple reports
    const reportCount = await this.prisma.moderationReport.count({
      where: { reportedUserId: creature.ownerId, status: 'pending' },
    });

    if (reportCount >= 5) {
      // Notify admins (would send email/Slack in production)
      console.warn(`[MODERATION] User ${creature.ownerId} has ${reportCount} pending reports`);
    }
  }
}
