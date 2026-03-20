import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { LLMService } from './llm.service';
import { PromptBuilder } from './prompt-builder';
import { PrismaService } from '../database/prisma.service';
import { MapService } from '../map/map.service';

interface LLMJob {
  creatureId: string;
  isInitial: boolean;
}

@Processor('llm-queue')
export class LLMProcessor {
  private readonly logger = new Logger(LLMProcessor.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly promptBuilder: PromptBuilder,
    private readonly prisma: PrismaService,
    private readonly mapService: MapService,
  ) {}

  @Process('execute-prompt')
  async executePrompt(job: Job<LLMJob>) {
    const { creatureId } = job.data;
    this.logger.log(`Processing LLM job for creature ${creatureId}`);

    try {
      // Load creature
      const creature = await this.prisma.creature.findUnique({
        where: { id: creatureId },
        include: {
          alliances: { select: { allyId: true } },
          memories: {
            orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
            take: 8,
          },
        },
      });

      if (!creature) {
        this.logger.warn(`Creature ${creatureId} not found`);
        return;
      }

      // Get nearby tiles (3x3 chunks)
      const nearbyTiles: any[] = [];
      try {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const chunk = await this.mapService.getChunk(
              creature.chunkX + dx,
              creature.chunkY + dy,
            );
            chunk.tiles.forEach((row: any[]) =>
              row.forEach((tile: any) => {
                if (tile.type !== 'grass') nearbyTiles.push(tile);
              }),
            );
          }
        }
      } catch (err) {
        this.logger.warn('Failed to load nearby tiles', err);
      }

      // Get nearby creatures
      const nearbyCreatureData = await this.prisma.creature.findMany({
        where: {
          chunkX: { gte: creature.chunkX - 2, lte: creature.chunkX + 2 },
          chunkY: { gte: creature.chunkY - 2, lte: creature.chunkY + 2 },
          id: { not: creatureId },
        },
        take: 10,
        select: {
          id: true,
          name: true,
          emoji: true,
          posX: true,
          posY: true,
          health: true,
          level: true,
        },
      });

      const allyIds = new Set(creature.alliances.map((a) => a.allyId));

      const context = {
        creature: {
          id: creature.id,
          name: creature.name,
          preset: creature.preset,
          level: creature.level,
          stats: {
            health: creature.health,
            maxHealth: creature.maxHealth,
            energy: creature.energy,
            maxEnergy: creature.maxEnergy,
            food: creature.food,
            maxFood: creature.maxFood,
            materials: creature.materials,
            maxMaterials: creature.maxMaterials,
            speed: creature.speed,
          },
          position: { x: creature.posX, y: creature.posY },
          totalTilesOwned: creature.totalTilesOwned,
          totalStructures: creature.totalStructures,
          biomeInventions: creature.biomeInventions,
          alliances: creature.alliances.map((a) => a.allyId),
          systemPrompt: creature.systemPrompt,
        },
        nearbyTiles: nearbyTiles.slice(0, 50),
        nearbyCreatures: nearbyCreatureData.map((c) => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          distance: Math.hypot(c.posX - creature.posX, c.posY - creature.posY),
          isAlly: allyIds.has(c.id),
          stats: { health: c.health, level: c.level },
        })),
        memories: creature.memories.map((m) => ({
          content: m.content,
          category: m.category,
          importance: m.importance,
        })),
        recentActions: [],
        worldTime: new Date().toISOString(),
      };

      const systemPrompt = this.promptBuilder.buildSystemPrompt(context);
      const userMessage = this.promptBuilder.buildUserMessage(context);

      // Call LLM
      const plan = await this.llmService.callLLM({
        provider: creature.llmProvider,
        model: creature.llmModel,
        encryptedApiKey: creature.encryptedApiKey,
        systemPrompt,
        userMessage,
      });

      // Save plan to creature
      await this.prisma.creature.update({
        where: { id: creatureId },
        data: {
          currentBehaviorPlan: plan as any,
          lastLLMCallAt: new Date(),
        },
      });

      // Store memory of this decision
      await this.prisma.creatureMemory.create({
        data: {
          creatureId,
          content: `Made a new plan: ${plan.summary}. Goal: ${plan.goal}`,
          category: 'exploration',
          importance: 6,
        },
      });

      this.logger.log(`LLM plan generated for ${creature.name}: ${plan.summary}`);
    } catch (error) {
      this.logger.error(`LLM job failed for creature ${creatureId}:`, error);
      throw error; // Bull will retry
    }
  }
}
