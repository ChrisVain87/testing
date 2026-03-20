import { Injectable } from '@nestjs/common';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

export type TileType =
  | 'grass' | 'forest' | 'mountain' | 'water' | 'desert' | 'snow'
  | 'swamp' | 'lava' | 'crystal' | 'void' | 'candy' | 'neon' | 'custom';

export interface GeneratedTile {
  x: number;
  y: number;
  type: TileType;
}

@Injectable()
export class TerrainGenerator {
  private noise2D: NoiseFunction2D;
  private biomeNoise: NoiseFunction2D;
  private moistureNoise: NoiseFunction2D;
  private worldSeed = 0;

  initialize(worldSeed: bigint): void {
    this.worldSeed = Number(worldSeed);
    // Simplex noise doesn't take a seed directly, so we use positional offset
    this.noise2D = createNoise2D(() => this.worldSeed / Number.MAX_SAFE_INTEGER);
    this.biomeNoise = createNoise2D(() => (this.worldSeed * 1.337) / Number.MAX_SAFE_INTEGER);
    this.moistureNoise = createNoise2D(() => (this.worldSeed * 2.618) / Number.MAX_SAFE_INTEGER);
  }

  generateChunk(chunkX: number, chunkY: number, chunkSize = 64): GeneratedTile[][] {
    const tiles: GeneratedTile[][] = [];

    for (let ty = 0; ty < chunkSize; ty++) {
      tiles[ty] = [];
      for (let tx = 0; tx < chunkSize; tx++) {
        const globalX = chunkX * chunkSize + tx;
        const globalY = chunkY * chunkSize + ty;
        tiles[ty][tx] = {
          x: globalX,
          y: globalY,
          type: this.getTileType(globalX, globalY),
        };
      }
    }

    return tiles;
  }

  getTileType(globalX: number, globalY: number): TileType {
    const scale = 0.005;
    const biomeScale = 0.002;
    const moistureScale = 0.003;

    // Elevation
    const elevation = (
      this.noise2D(globalX * scale, globalY * scale) * 0.6 +
      this.noise2D(globalX * scale * 2, globalY * scale * 2) * 0.3 +
      this.noise2D(globalX * scale * 4, globalY * scale * 4) * 0.1
    );

    // Temperature (varies with latitude roughly)
    const biome = this.biomeNoise(globalX * biomeScale, globalY * biomeScale);

    // Moisture
    const moisture = this.moistureNoise(globalX * moistureScale, globalY * moistureScale);

    // Classify tile
    if (elevation < -0.35) return 'water';
    if (elevation < -0.2) return moisture > 0.2 ? 'swamp' : 'water';
    if (elevation > 0.6) return biome > 0.3 ? 'snow' : 'mountain';
    if (elevation > 0.4) return 'mountain';

    // Mid elevation - temperature/moisture based biomes
    if (biome > 0.5) {
      if (moisture < -0.3) return 'desert';
      if (moisture > 0.4) return 'forest';
      return 'grass';
    }

    if (biome < -0.5) {
      if (elevation > 0.2) return 'crystal';
      return moisture > 0 ? 'swamp' : 'void';
    }

    if (moisture < -0.4) return 'desert';
    if (moisture > 0.5) return 'forest';
    return 'grass';
  }
}
