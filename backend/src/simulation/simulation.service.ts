import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { MapService } from '../map/map.service';
import { CreaturesService } from '../creatures/creatures.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface SimulatedCreature {
  id: string;
  name: string;
  emoji: string;
  posX: number;
  posY: number;
  chunkX: number;
  chunkY: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  food: number;
  maxFood: number;
  materials: number;
  maxMaterials: number;
  speed: number;
  level: number;
  experience: number;
  currentBehaviorPlan: any;
  currentActionIndex: number;
  isOnline: boolean;
}

@Injectable()
export class SimulationService implements OnModuleInit {
  private readonly logger = new Logger(SimulationService.name);
  private activeCreatures = new Map<string, SimulatedCreature>();
  private tickInterval: NodeJS.Timer | null = null;
  private readonly TICK_RATE: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mapService: MapService,
    private readonly creaturesService: CreaturesService,
    private readonly events: EventEmitter2,
  ) {
    this.TICK_RATE = this.config.get<number>('simulation.tickRateHz', 10)!;
  }

  async onModuleInit() {
    // Load active creatures into memory
    await this.loadActiveCreatures();
    this.startTickLoop();
    this.logger.log(`Simulation started at ${this.TICK_RATE}Hz`);
  }

  private async loadActiveCreatures() {
    const creatures = await this.prisma.creature.findMany({
      where: { isOnline: true },
      take: this.config.get<number>('simulation.maxActiveCreatures', 5000),
    });

    for (const c of creatures) {
      this.activeCreatures.set(c.id, this.mapToSimCreature(c));
    }

    this.logger.log(`Loaded ${creatures.length} active creatures`);
  }

  private startTickLoop() {
    const intervalMs = 1000 / this.TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), intervalMs);
  }

  private async tick() {
    const now = Date.now();
    const updates: Array<{ creatureId: string; posX?: number; posY?: number; stats?: any }> = [];

    for (const [id, creature] of this.activeCreatures) {
      try {
        const update = await this.processCreatureTick(creature);
        if (update) {
          updates.push({ creatureId: id, ...update });
        }
      } catch (err) {
        this.logger.warn(`Tick error for creature ${id}:`, err);
      }
    }

    // Emit position/stat updates via WebSocket (batched)
    if (updates.length > 0) {
      this.events.emit('simulation.updates', updates);
    }
  }

  private async processCreatureTick(creature: SimulatedCreature): Promise<any> {
    if (!creature.currentBehaviorPlan?.actions?.length) return null;

    const actions = creature.currentBehaviorPlan.actions;
    const currentAction = actions[creature.currentActionIndex];

    if (!currentAction || currentAction.completed) {
      // Move to next action
      creature.currentActionIndex = Math.min(
        creature.currentActionIndex + 1,
        actions.length - 1,
      );
      return null;
    }

    // Passive resource drain (per tick)
    creature.food = Math.max(0, creature.food - 0.001);
    creature.energy = Math.max(0, creature.energy - 0.0005);

    // Process current action
    const result = await this.executeAction(creature, currentAction);
    return result;
  }

  private async executeAction(creature: SimulatedCreature, action: any): Promise<any> {
    switch (action.type) {
      case 'explore':
      case 'move_to':
        return this.handleMovement(creature, action);

      case 'claim_land':
        return this.handleClaimLand(creature, action);

      case 'build_structure':
        return this.handleBuildStructure(creature, action);

      case 'terraform_tile':
        return this.handleTerraform(creature, action);

      case 'invent_new_biome':
        return this.handleInventBiome(creature, action);

      case 'interact':
        return this.handleInteract(creature, action);

      case 'gather_resources':
        return this.handleGatherResources(creature, action);

      case 'rest':
        return this.handleRest(creature, action);

      default:
        action.completed = true;
        return null;
    }
  }

  private async handleMovement(creature: SimulatedCreature, action: any): Promise<any> {
    if (creature.energy < 1) {
      // Not enough energy
      return null;
    }

    const targetChunkX = action.params.chunkX ?? creature.chunkX;
    const targetChunkY = action.params.chunkY ?? creature.chunkY;
    const speed = Math.min(action.params.speed ?? creature.speed, creature.speed * 2);

    // Simple pathfinding: move one step toward target per tick
    const dx = targetChunkX - creature.chunkX;
    const dy = targetChunkY - creature.chunkY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      action.completed = true;
      return null;
    }

    const moveX = Math.round((dx / dist) * speed * 2);
    const moveY = Math.round((dy / dist) * speed * 2);

    creature.posX += moveX;
    creature.posY += moveY;
    creature.chunkX = Math.floor(creature.posX / 64);
    creature.chunkY = Math.floor(creature.posY / 64);
    creature.energy -= 0.5;

    // Update in memory
    this.activeCreatures.set(creature.id, creature);

    // Persist every 10 moves (don't hit DB every tick)
    if (Math.random() < 0.1) {
      await this.creaturesService.updatePosition(creature.id, creature.posX, creature.posY);
    }

    return {
      posX: creature.posX,
      posY: creature.posY,
      chunkX: creature.chunkX,
      chunkY: creature.chunkY,
    };
  }

  private async handleClaimLand(creature: SimulatedCreature, action: any): Promise<any> {
    const radius = Math.min(action.params.radiusTiles ?? 3, 10);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (action.params.shape === 'circle' && Math.sqrt(dx * dx + dy * dy) > radius) continue;
        await this.mapService.claimTile(
          creature.posX + dx,
          creature.posY + dy,
          creature.id,
        );
      }
    }

    action.completed = true;

    // Add memory
    await this.creaturesService.addMemory(
      creature.id,
      `Claimed a ${radius}-tile radius of land at (${creature.posX}, ${creature.posY})`,
      'exploration',
      5,
    );

    this.emitWorldEvent(creature, 'land_claimed', { radius, posX: creature.posX, posY: creature.posY });
    return null;
  }

  private async handleBuildStructure(creature: SimulatedCreature, action: any): Promise<any> {
    const costMap: Record<string, number> = {
      hut: 10, tower: 30, bridge: 15, wall: 20, farm: 25,
      mine: 35, library: 40, market: 50, portal: 60, beacon: 20, custom: 30,
    };

    const type = action.params.type ?? 'hut';
    const cost = costMap[type] ?? 30;

    if (creature.materials < cost) {
      action.completed = true;
      return null;
    }

    creature.materials -= cost;

    await this.mapService.buildStructure(
      creature.id,
      type,
      action.params.posX ?? creature.posX,
      action.params.posY ?? creature.posY,
      action.params.customName,
      action.params.params,
    );

    action.completed = true;

    await this.creaturesService.addMemory(
      creature.id,
      `Built a ${action.params.customName ?? type} at (${action.params.posX}, ${action.params.posY})`,
      'building',
      7,
    );

    this.emitWorldEvent(creature, 'structure_built', {
      structureType: type,
      structureName: action.params.customName,
    });

    return null;
  }

  private async handleTerraform(creature: SimulatedCreature, action: any): Promise<any> {
    if (creature.energy < 10) {
      action.completed = true;
      return null;
    }

    creature.energy -= 10;
    await this.mapService.claimTile(
      action.params.posX ?? creature.posX,
      action.params.posY ?? creature.posY,
      creature.id,
      action.params.newType,
      {
        customName: action.params.customName,
        color: action.params.color,
      },
    );

    action.completed = true;
    return null;
  }

  private async handleInventBiome(creature: SimulatedCreature, action: any): Promise<any> {
    if (creature.energy < 50) {
      action.completed = true;
      return null;
    }

    creature.energy -= 50;

    const biome = await this.mapService.createCustomBiome(
      creature.id,
      action.params.name ?? 'Mystery Biome',
      action.params.tileType ?? 'custom',
      action.params.color ?? 0xffffff,
      action.params.rules ?? {},
      action.params.description ?? 'A new biome invented by this creature',
    );

    action.completed = true;

    await this.creaturesService.addMemory(
      creature.id,
      `Invented a new biome: "${biome.name}" - ${biome.description}`,
      'discovery',
      9,
    );

    this.emitWorldEvent(creature, 'biome_invented', {
      biomeName: biome.name,
      biomeId: biome.id,
      description: biome.description,
    });

    return null;
  }

  private async handleInteract(creature: SimulatedCreature, action: any): Promise<any> {
    const targetId = action.params.creatureId;
    if (!targetId) {
      action.completed = true;
      return null;
    }

    switch (action.params.action) {
      case 'ally':
        await this.prisma.creatureAlliance.upsert({
          where: {
            creatureId_allyId: {
              creatureId: creature.id,
              allyId: targetId,
            },
          },
          create: { creatureId: creature.id, allyId: targetId },
          update: {},
        });
        await this.creaturesService.addMemory(
          creature.id,
          `Formed an alliance with creature ${targetId.slice(0, 8)}`,
          'social',
          8,
        );
        this.emitWorldEvent(creature, 'alliance', { targetId });
        break;

      case 'fight':
        // Simple combat: both take damage
        creature.health -= 10;
        await this.creaturesService.updateStats(creature.id, { health: creature.health });
        await this.creaturesService.updateStats(targetId, { health: Math.max(0, -10) });
        this.emitWorldEvent(creature, 'battle', { targetId, attackerName: creature.name });
        break;
    }

    action.completed = true;
    return null;
  }

  private async handleGatherResources(creature: SimulatedCreature, action: any): Promise<any> {
    const type = action.params.type ?? 'food';
    const amount = Math.floor(Math.random() * 20) + 10;

    switch (type) {
      case 'food':
        creature.food = Math.min(creature.maxFood, creature.food + amount);
        break;
      case 'materials':
        creature.materials = Math.min(creature.maxMaterials, creature.materials + amount);
        break;
      case 'energy':
        creature.energy = Math.min(creature.maxEnergy, creature.energy + amount);
        break;
    }

    action.completed = true;
    return { stats: { [type]: (creature as any)[type] } };
  }

  private async handleRest(creature: SimulatedCreature, action: any): Promise<any> {
    // Regenerate stats during rest
    creature.health = Math.min(creature.maxHealth, creature.health + 0.1);
    creature.energy = Math.min(creature.maxEnergy, creature.energy + 0.2);

    // Complete after ~60 ticks per minute
    if (!action._restTicks) action._restTicks = 0;
    action._restTicks++;

    const durationTicks = (action.params.duration ?? 30) * this.TICK_RATE * 60;
    if (action._restTicks >= durationTicks) {
      action.completed = true;
    }

    return null;
  }

  private emitWorldEvent(creature: SimulatedCreature, type: string, details: any) {
    this.events.emit('world.event', {
      type,
      creatureId: creature.id,
      creatureName: creature.name,
      details,
      posX: creature.posX,
      posY: creature.posY,
      chunkX: creature.chunkX,
      chunkY: creature.chunkY,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Periodic cleanup ──────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async syncActiveCreatures() {
    // Persist all active creature positions/stats to DB
    const updates: Promise<any>[] = [];
    for (const creature of this.activeCreatures.values()) {
      updates.push(
        this.creaturesService.updatePosition(creature.id, creature.posX, creature.posY),
        this.creaturesService.updateStats(creature.id, {
          health: Math.floor(creature.health),
          energy: Math.floor(creature.energy),
          food: Math.floor(creature.food),
          materials: Math.floor(creature.materials),
        }),
      );
    }
    await Promise.allSettled(updates);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshCreatureList() {
    await this.loadActiveCreatures();
  }

  // Public API for WebSocket gateway
  addCreatureToSimulation(creature: any) {
    this.activeCreatures.set(creature.id, this.mapToSimCreature(creature));
  }

  removeCreatureFromSimulation(creatureId: string) {
    this.activeCreatures.delete(creatureId);
  }

  private mapToSimCreature(c: any): SimulatedCreature {
    return {
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      posX: c.posX,
      posY: c.posY,
      chunkX: c.chunkX,
      chunkY: c.chunkY,
      health: c.health,
      maxHealth: c.maxHealth,
      energy: c.energy,
      maxEnergy: c.maxEnergy,
      food: c.food,
      maxFood: c.maxFood,
      materials: c.materials,
      maxMaterials: c.maxMaterials,
      speed: c.speed,
      level: c.level,
      experience: c.experience,
      currentBehaviorPlan: c.currentBehaviorPlan,
      currentActionIndex: 0,
      isOnline: c.isOnline,
    };
  }
}
