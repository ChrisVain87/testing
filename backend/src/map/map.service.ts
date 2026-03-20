import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TerrainGenerator } from './terrain-generator';

const CHUNK_SIZE = 64;

@Injectable()
export class MapService implements OnModuleInit {
  private worldSeed: bigint = 0n;

  constructor(
    private readonly prisma: PrismaService,
    private readonly terrain: TerrainGenerator,
  ) {}

  async onModuleInit() {
    // Fetch or create global seed
    let seedRecord = await this.prisma.globalSeed.findUnique({ where: { id: 1 } });
    if (!seedRecord) {
      seedRecord = await this.prisma.globalSeed.create({
        data: {
          id: 1,
          seed: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
        },
      });
    }
    this.worldSeed = seedRecord.seed;
    this.terrain.initialize(this.worldSeed);
  }

  async getChunk(chunkX: number, chunkY: number) {
    // Load from DB (if modified) or generate procedurally
    const dbChunk = await this.prisma.chunk.findUnique({
      where: { x_y: { x: chunkX, y: chunkY } },
      include: {
        tiles: {
          include: {
            owner: {
              select: { id: true, name: true, emoji: true },
            },
          },
        },
      },
    });

    // Generate base tile grid
    const generatedTiles = this.terrain.generateChunk(chunkX, chunkY, CHUNK_SIZE);

    // Build 2D tile array
    const tileGrid: any[][] = Array.from({ length: CHUNK_SIZE }, (_, ty) =>
      Array.from({ length: CHUNK_SIZE }, (_, tx) => ({
        x: tx,
        y: ty,
        type: generatedTiles[ty][tx].type,
        ownerId: null,
        ownerUsername: null,
        customName: null,
        customColor: null,
        customProperties: null,
        structureId: null,
      })),
    );

    // Overlay DB tiles (claimed/modified)
    if (dbChunk?.tiles) {
      for (const tile of dbChunk.tiles) {
        const localX = ((tile.globalX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((tile.globalY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        if (tileGrid[localY] && tileGrid[localY][localX]) {
          tileGrid[localY][localX] = {
            x: localX,
            y: localY,
            type: tile.type,
            ownerId: tile.ownerId,
            ownerUsername: (tile.owner as any)?.name ?? null,
            customName: tile.customName,
            customColor: tile.customColor,
            customProperties: tile.customProperties,
            structureId: null,
          };
        }
      }
    }

    // Load structures in chunk
    const structures = await this.prisma.structure.findMany({
      where: { chunkX, chunkY },
    });

    // Load creatures in chunk
    const creatures = await this.prisma.creature.findMany({
      where: { chunkX, chunkY },
      select: {
        id: true,
        name: true,
        emoji: true,
        posX: true,
        posY: true,
        chunkX: true,
        chunkY: true,
        owner: { select: { username: true } },
      },
    });

    return {
      x: chunkX,
      y: chunkY,
      tiles: tileGrid,
      structures: structures.map((s) => ({
        id: s.id,
        type: s.type,
        customName: s.customName,
        ownerId: s.ownerId,
        posX: s.posX,
        posY: s.posY,
        level: s.level,
        properties: s.properties,
        createdAt: s.createdAt.toISOString(),
      })),
      creatures: creatures.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        ownerUsername: c.owner.username,
        position: {
          x: c.posX,
          y: c.posY,
          chunkX: c.chunkX,
          chunkY: c.chunkY,
        },
      })),
      lastModified: dbChunk?.lastModAt.toISOString() ?? new Date().toISOString(),
    };
  }

  async getChunks(chunkXs: number[], chunkYs: number[]) {
    return Promise.all(
      chunkXs.map((x, i) => this.getChunk(x, chunkYs[i])),
    );
  }

  async ensureChunkExists(chunkX: number, chunkY: number) {
    await this.prisma.chunk.upsert({
      where: { x_y: { x: chunkX, y: chunkY } },
      update: {},
      create: {
        x: chunkX,
        y: chunkY,
        seed: this.worldSeed ^ BigInt(chunkX * 73856093 ^ chunkY * 19349663),
      },
    });
  }

  async claimTile(globalX: number, globalY: number, creatureId: string, tileType?: string, customProps?: any) {
    const chunkX = Math.floor(globalX / CHUNK_SIZE);
    const chunkY = Math.floor(globalY / CHUNK_SIZE);

    await this.ensureChunkExists(chunkX, chunkY);

    const chunk = await this.prisma.chunk.findUnique({ where: { x_y: { x: chunkX, y: chunkY } } });
    if (!chunk) return;

    const existingTile = await this.prisma.tile.findUnique({
      where: { globalX_globalY: { globalX, globalY } },
    });

    // Can't claim another creature's tile
    if (existingTile?.ownerId && existingTile.ownerId !== creatureId) {
      return null;
    }

    const tile = await this.prisma.tile.upsert({
      where: { globalX_globalY: { globalX, globalY } },
      create: {
        globalX,
        globalY,
        chunkX,
        chunkY,
        type: tileType ?? this.terrain.getTileType(globalX, globalY),
        ownerId: creatureId,
        chunkId: chunk.id,
        customProperties: customProps ?? {},
      },
      update: {
        ownerId: creatureId,
        type: tileType ?? undefined,
        customProperties: customProps ?? undefined,
        updatedAt: new Date(),
      },
    });

    // Update chunk dirty flag
    await this.prisma.chunk.update({
      where: { id: chunk.id },
      data: { isDirty: true, lastModAt: new Date() },
    });

    // Update creature tile count
    await this.prisma.creature.update({
      where: { id: creatureId },
      data: { totalTilesOwned: { increment: existingTile?.ownerId === creatureId ? 0 : 1 } },
    });

    return tile;
  }

  async buildStructure(creatureId: string, type: string, posX: number, posY: number, customName?: string, properties?: any) {
    const chunkX = Math.floor(posX / CHUNK_SIZE);
    const chunkY = Math.floor(posY / CHUNK_SIZE);

    // Claim the tile first
    await this.claimTile(posX, posY, creatureId);

    const structure = await this.prisma.structure.create({
      data: {
        type,
        customName,
        posX,
        posY,
        chunkX,
        chunkY,
        ownerId: creatureId,
        properties: properties ?? {},
      },
    });

    await this.prisma.creature.update({
      where: { id: creatureId },
      data: { totalStructures: { increment: 1 } },
    });

    return structure;
  }

  async createCustomBiome(creatureId: string, name: string, tileType: string, color: number, rules: any, description: string) {
    // Content moderation
    const biome = await this.prisma.customBiome.create({
      data: {
        name,
        tileType,
        color,
        rules,
        description,
        inventedById: creatureId,
      },
    });

    await this.prisma.creature.update({
      where: { id: creatureId },
      data: { biomeInventions: { increment: 1 } },
    });

    return biome;
  }

  async getTopBiomes(limit = 20) {
    return this.prisma.customBiome.findMany({
      where: { isApproved: true },
      orderBy: { popularity: 'desc' },
      take: limit,
      include: {
        inventedBy: { select: { name: true } },
      },
    });
  }
}
