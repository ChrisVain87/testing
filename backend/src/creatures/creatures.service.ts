import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as CryptoJS from 'crypto-js';
import { PrismaService } from '../database/prisma.service';
import { MapService } from '../map/map.service';
import type { CreateCreatureDto } from './dto/create-creature.dto';
import type { UpdatePromptDto } from './dto/update-prompt.dto';

const CREATURE_EMOJIS: Record<string, string> = {
  blobbo: '🫧', fuzzling: '🦔', snorkle: '🐊', zipplet: '⚡',
  gloomp: '🌿', wobblo: '🐙', squidlet: '🦑', boomba: '💣',
  fluffnik: '🐰', crinkle: '🦎', plonker: '🐸', zazzle: '🌟',
};

const LLM_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.0-flash',
  xai: 'grok-2-mini',
};

@Injectable()
export class CreaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mapService: MapService,
    @InjectQueue('llm-queue') private readonly llmQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateCreatureDto) {
    // One creature per user
    const existing = await this.prisma.creature.findUnique({ where: { ownerId: userId } });
    if (existing) throw new ConflictException('You already have a creature');

    // Encrypt API key
    const encryptedApiKey = CryptoJS.AES.encrypt(
      dto.apiKey,
      this.config.get('encryption.key')!,
    ).toString();

    // Spawn at random location
    const spawnX = Math.floor(Math.random() * 1000) - 500;
    const spawnY = Math.floor(Math.random() * 1000) - 500;
    const chunkX = Math.floor(spawnX / 64);
    const chunkY = Math.floor(spawnY / 64);

    const creature = await this.prisma.creature.create({
      data: {
        name: dto.name,
        preset: dto.preset,
        colorVariant: dto.colorVariant,
        emoji: CREATURE_EMOJIS[dto.preset] ?? '🌟',
        ownerId: userId,
        llmProvider: dto.llmProvider,
        llmModel: LLM_DEFAULT_MODELS[dto.llmProvider] ?? 'gpt-4o-mini',
        encryptedApiKey,
        posX: spawnX,
        posY: spawnY,
        chunkX,
        chunkY,
        systemPrompt: dto.systemPrompt,
        promptCooldownEndsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });

    // Ensure spawn chunk exists
    await this.mapService.ensureChunkExists(chunkX, chunkY);

    // Claim initial tile
    await this.mapService.claimTile(spawnX, spawnY, creature.id);

    // Queue first LLM call
    await this.llmQueue.add('execute-prompt', {
      creatureId: creature.id,
      isInitial: true,
    }, {
      delay: 2000, // 2s delay to let DB settle
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return this.formatCreature(creature);
  }

  async findMyCreature(userId: string) {
    const creature = await this.prisma.creature.findUnique({
      where: { ownerId: userId },
      include: {
        alliances: { select: { allyId: true } },
      },
    });

    if (!creature) throw new NotFoundException('Creature not found');
    return this.formatCreature(creature);
  }

  async findById(id: string) {
    const creature = await this.prisma.creature.findUnique({
      where: { id },
      include: {
        alliances: { select: { allyId: true } },
      },
    });

    if (!creature) throw new NotFoundException('Creature not found');
    return this.formatCreature(creature);
  }

  async updatePrompt(userId: string, dto: UpdatePromptDto) {
    const creature = await this.prisma.creature.findUnique({ where: { ownerId: userId } });
    if (!creature) throw new NotFoundException('Creature not found');

    // Check cooldown
    if (creature.promptCooldownEndsAt && creature.promptCooldownEndsAt > new Date()) {
      const msLeft = creature.promptCooldownEndsAt.getTime() - Date.now();
      const hoursLeft = Math.ceil(msLeft / 3600000);
      throw new ForbiddenException(`Cooldown active. Try again in ~${hoursLeft}h`);
    }

    // Moderation: check for obviously offensive content
    if (this.isOffensiveContent(dto.systemPrompt)) {
      throw new BadRequestException('Prompt contains prohibited content');
    }

    const cooldownEndsAt = new Date(
      Date.now() + this.config.get<number>('llm.promptCooldownHours')! * 3600000,
    );

    await this.prisma.creature.update({
      where: { id: creature.id },
      data: {
        systemPrompt: dto.systemPrompt,
        promptCooldownEndsAt: cooldownEndsAt,
      },
    });

    // Queue LLM re-evaluation
    await this.llmQueue.add('execute-prompt', {
      creatureId: creature.id,
      isInitial: false,
    }, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { cooldownEndsAt: cooldownEndsAt.toISOString() };
  }

  async getLeaderboard(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.creature.findMany({
        orderBy: [{ totalTilesOwned: 'desc' }, { level: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          alliances: { select: { allyId: true } },
        },
      }),
      this.prisma.creature.count(),
    ]);

    return {
      items: items.map((c) => this.formatCreature(c)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async getMemories(userId: string, page: number, limit: number) {
    const creature = await this.prisma.creature.findUnique({ where: { ownerId: userId } });
    if (!creature) throw new NotFoundException('Creature not found');

    const [items, total] = await Promise.all([
      this.prisma.creatureMemory.findMany({
        where: { creatureId: creature.id },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.creatureMemory.count({ where: { creatureId: creature.id } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async updatePosition(creatureId: string, x: number, y: number) {
    const chunkX = Math.floor(x / 64);
    const chunkY = Math.floor(y / 64);

    await this.prisma.creature.update({
      where: { id: creatureId },
      data: { posX: x, posY: y, chunkX, chunkY },
    });
  }

  async updateStats(creatureId: string, stats: Partial<{
    health: number; energy: number; food: number; materials: number;
    level: number; experience: number;
  }>) {
    await this.prisma.creature.update({
      where: { id: creatureId },
      data: stats,
    });
  }

  async addMemory(creatureId: string, content: string, category: string, importance: number) {
    return this.prisma.creatureMemory.create({
      data: {
        creatureId,
        content,
        category,
        importance,
      },
    });
  }

  private formatCreature(creature: any) {
    const { encryptedApiKey, ...rest } = creature;
    void encryptedApiKey;

    return {
      id: rest.id,
      name: rest.name,
      preset: rest.preset,
      colorVariant: rest.colorVariant,
      emoji: rest.emoji,
      ownerId: rest.ownerId,
      ownerUsername: rest.owner?.username ?? '',
      position: {
        x: rest.posX,
        y: rest.posY,
        chunkX: rest.chunkX,
        chunkY: rest.chunkY,
      },
      stats: {
        health: rest.health,
        maxHealth: rest.maxHealth,
        energy: rest.energy,
        maxEnergy: rest.maxEnergy,
        food: rest.food,
        maxFood: rest.maxFood,
        materials: rest.materials,
        maxMaterials: rest.maxMaterials,
        speed: rest.speed,
        level: rest.level,
        experience: rest.experience,
        experienceToNext: rest.level * 100,
      },
      systemPrompt: rest.systemPrompt,
      currentBehaviorPlan: rest.currentBehaviorPlan,
      promptCooldownEndsAt: rest.promptCooldownEndsAt?.toISOString() ?? null,
      lastLLMCallAt: rest.lastLLMCallAt?.toISOString() ?? null,
      totalTilesOwned: rest.totalTilesOwned,
      totalStructures: rest.totalStructures,
      biomeInventions: rest.biomeInventions,
      alliances: rest.alliances?.map((a: any) => a.allyId) ?? [],
      isOnline: rest.isOnline,
      createdAt: rest.createdAt?.toISOString(),
    };
  }

  private isOffensiveContent(text: string): boolean {
    const blocklist = ['[offensive term 1]', '[offensive term 2]']; // Replace with actual moderation logic
    return blocklist.some((term) => text.toLowerCase().includes(term));
  }
}
