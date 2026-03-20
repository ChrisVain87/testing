import Phaser from 'phaser';
import { TILE_COLORS, type Tile, type TileType, type Chunk, type Creature } from '../../types';
import { api } from '../../services/api';
import { useGameStore } from '../../store/gameStore';
import { socketService } from '../../services/socket';

const TILE_SIZE = 32;
const CHUNK_SIZE = 64;
const CHUNK_PX = TILE_SIZE * CHUNK_SIZE; // 2048px per chunk
const VISIBLE_CHUNKS = 3; // Render 3x3 chunks around camera

interface CreatureSprite {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  emoji: Phaser.GameObjects.Text;
  nameTag: Phaser.GameObjects.Text;
  creatureId: string;
  targetX: number;
  targetY: number;
}

export class WorldScene extends Phaser.Scene {
  // Chunk graphics cache
  private chunkGraphics = new Map<string, Phaser.GameObjects.RenderTexture>();
  private loadedChunks = new Set<string>();
  private loadingChunks = new Set<string>();

  // Creature sprites
  private creatureSprites = new Map<string, CreatureSprite>();
  private myCreatureSprite: CreatureSprite | null = null;

  // Camera
  private cam!: Phaser.Cameras.Scene2D.Camera;
  private isDragging = false;
  private lastPointerPos = { x: 0, y: 0 };
  private targetZoom = 1;
  private minZoom = 0.1;
  private maxZoom = 4;

  // Subscribed chunks
  private subscribedChunks = new Set<string>();

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    this.cam = this.cameras.main;
    this.cam.setBackgroundColor(0x0d0d1a);

    this.setupInput();
    this.setupTickLoop();
    this.setupStoreSubscription();

    // Initial load
    this.loadVisibleChunks();

    // Minimap scene
    this.scene.launch('UIScene');
  }

  // ── Input ─────────────────────────────────────────────────
  private setupInput(): void {
    // Drag to pan
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown() || (ptr.buttons === 4)) return; // ignore right/middle
      this.isDragging = true;
      this.lastPointerPos = { x: ptr.x, y: ptr.y };
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = (ptr.x - this.lastPointerPos.x) / this.cam.zoom;
      const dy = (ptr.y - this.lastPointerPos.y) / this.cam.zoom;
      this.cam.scrollX -= dx;
      this.cam.scrollY -= dy;
      this.lastPointerPos = { x: ptr.x, y: ptr.y };
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Pinch/scroll to zoom
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _go: unknown[], dx: number, dy: number) => {
      const zoomDelta = dy > 0 ? -0.1 : 0.1;
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom + zoomDelta, this.minZoom, this.maxZoom);
    });

    // Pinch gesture on mobile
    this.input.addPointer(2);
    let lastPinchDist = 0;
    this.input.on('pointermove', () => {
      const ptrs = this.input.manager.pointers;
      const p1 = ptrs[1];
      const p2 = ptrs[2];
      if (p1?.isDown && p2?.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (lastPinchDist > 0) {
          const delta = (dist - lastPinchDist) * 0.005;
          this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, this.minZoom, this.maxZoom);
        }
        lastPinchDist = dist;
      } else {
        lastPinchDist = 0;
      }
    });

    // Click on tile to show info
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (Math.abs(ptr.upX - ptr.downX) > 5 || Math.abs(ptr.upY - ptr.downY) > 5) return;
      const worldX = this.cam.scrollX + ptr.x / this.cam.zoom;
      const worldY = this.cam.scrollY + ptr.y / this.cam.zoom;
      const tileX = Math.floor(worldX / TILE_SIZE);
      const tileY = Math.floor(worldY / TILE_SIZE);
      const event = new CustomEvent('game:tile_clicked', { detail: { tileX, tileY, worldX, worldY } });
      window.dispatchEvent(event);
    });

    // Double-click to center on my creature
    this.input.on('pointerdblclick', () => {
      this.centerOnMyCreature();
    });
  }

  // ── Store Subscription ────────────────────────────────────
  private setupStoreSubscription(): void {
    // Listen to camera target changes from UI
    window.addEventListener('game:center_camera', (e: Event) => {
      const { x, y } = (e as CustomEvent).detail;
      this.cam.centerOn(x * TILE_SIZE, y * TILE_SIZE);
    });

    // Listen for creature updates
    window.addEventListener('game:creature_updated', () => {
      this.updateMyCreatureSprite();
    });
  }

  // ── Tick Loop ─────────────────────────────────────────────
  private setupTickLoop(): void {
    // Check visible chunks every 500ms
    this.time.addEvent({
      delay: 500,
      callback: this.loadVisibleChunks,
      callbackScope: this,
      loop: true,
    });

    // Smooth creature movement at 10fps
    this.time.addEvent({
      delay: 100,
      callback: this.updateCreaturePositions,
      callbackScope: this,
      loop: true,
    });
  }

  // ── Chunk Loading ─────────────────────────────────────────
  private loadVisibleChunks(): void {
    const { scrollX, scrollY, zoom, width, height } = this.cam;
    const halfW = width / 2 / zoom;
    const halfH = height / 2 / zoom;
    const centerX = scrollX + halfW;
    const centerY = scrollY + halfH;

    const centerChunkX = Math.floor(centerX / CHUNK_PX);
    const centerChunkY = Math.floor(centerY / CHUNK_PX);

    const chunksToLoad: string[] = [];
    const visibleKeys = new Set<string>();

    for (let dx = -VISIBLE_CHUNKS; dx <= VISIBLE_CHUNKS; dx++) {
      for (let dy = -VISIBLE_CHUNKS; dy <= VISIBLE_CHUNKS; dy++) {
        const cx = centerChunkX + dx;
        const cy = centerChunkY + dy;
        const key = `${cx},${cy}`;
        visibleKeys.add(key);
        if (!this.loadedChunks.has(key) && !this.loadingChunks.has(key)) {
          chunksToLoad.push(key);
        }
      }
    }

    // Unload far chunks
    for (const key of this.loadedChunks) {
      if (!visibleKeys.has(key)) {
        this.unloadChunk(key);
      }
    }

    // Update socket subscriptions
    const newSubs = new Set<string>();
    for (const key of visibleKeys) {
      newSubs.add(key);
    }
    const toAdd = [...newSubs].filter((k) => !this.subscribedChunks.has(k));
    const toRemove = [...this.subscribedChunks].filter((k) => !newSubs.has(k));
    if (toAdd.length > 0) socketService.subscribeToChunks(toAdd);
    if (toRemove.length > 0) socketService.unsubscribeFromChunks(toRemove);
    this.subscribedChunks = newSubs;

    // Load new chunks in batches
    if (chunksToLoad.length > 0) {
      chunksToLoad.forEach((key) => this.loadingChunks.add(key));
      const chunkXs = chunksToLoad.map((k) => parseInt(k.split(',')[0]));
      const chunkYs = chunksToLoad.map((k) => parseInt(k.split(',')[1]));
      api.getChunks(chunkXs, chunkYs).then(({ data: chunks }) => {
        chunks.forEach((chunk) => {
          const key = `${chunk.x},${chunk.y}`;
          this.renderChunk(chunk);
          useGameStore.getState().setChunk(key, chunk);
          this.loadedChunks.add(key);
          this.loadingChunks.delete(key);
          this.updateCreaturesInChunk(chunk);
        });
      }).catch(() => {
        chunksToLoad.forEach((key) => this.loadingChunks.delete(key));
      });
    }
  }

  // ── Chunk Rendering ───────────────────────────────────────
  private renderChunk(chunk: Chunk): void {
    const key = `${chunk.x},${chunk.y}`;
    if (this.chunkGraphics.has(key)) return;

    const worldX = chunk.x * CHUNK_PX;
    const worldY = chunk.y * CHUNK_PX;

    const rt = this.add.renderTexture(worldX, worldY, CHUNK_PX, CHUNK_PX);
    rt.setOrigin(0, 0);

    const gfx = this.add.graphics();

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tile = chunk.tiles[ty]?.[tx];
        if (!tile) continue;

        const color = tile.customColor ?? TILE_COLORS[tile.type as TileType] ?? 0x333333;
        const brightness = this.getTileBrightness(tx, ty, tile);

        gfx.fillStyle(color, 1);
        gfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);

        // Tile ownership border
        if (tile.ownerId) {
          gfx.lineStyle(1, 0xffffff, 0.15);
          gfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
        }

        // Brightness overlay for height variation
        if (brightness !== 1) {
          const overlayAlpha = brightness > 1 ? brightness - 1 : 1 - brightness;
          const overlayColor = brightness > 1 ? 0xffffff : 0x000000;
          gfx.fillStyle(overlayColor, overlayAlpha * 0.3);
          gfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }
    }

    rt.draw(gfx);
    gfx.destroy();

    // Draw structures
    chunk.structures.forEach((struct) => {
      const localX = (struct.posX % CHUNK_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const localY = (struct.posY % CHUNK_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const structGfx = this.add.graphics();
      structGfx.fillStyle(0xffd700, 1);
      structGfx.fillRect(localX - 8, localY - 8, 16, 16);
      rt.draw(structGfx);
      structGfx.destroy();
    });

    this.chunkGraphics.set(key, rt);
  }

  private getTileBrightness(tx: number, ty: number, _tile: Tile): number {
    // Simple pseudo-height based on position for visual variety
    const noise = Math.sin(tx * 0.3) * Math.cos(ty * 0.3) * 0.2;
    return 1 + noise;
  }

  private unloadChunk(key: string): void {
    const rt = this.chunkGraphics.get(key);
    if (rt) {
      rt.destroy();
      this.chunkGraphics.delete(key);
    }
    this.loadedChunks.delete(key);
  }

  // ── Creature Sprites ──────────────────────────────────────
  private updateMyCreatureSprite(): void {
    const { myCreature } = useGameStore.getState();
    if (!myCreature) return;

    const worldX = myCreature.position.x * TILE_SIZE;
    const worldY = myCreature.position.y * TILE_SIZE;

    if (!this.myCreatureSprite) {
      this.myCreatureSprite = this.createCreatureSprite(myCreature, true);
    }

    const sprite = this.myCreatureSprite;
    sprite.targetX = worldX;
    sprite.targetY = worldY;
    sprite.nameTag.setText(myCreature.name);
  }

  private createCreatureSprite(creature: Creature | { id: string; name: string; emoji: string; position: { x: number; y: number }; ownerUsername: string }, isOwn = false): CreatureSprite {
    const worldX = creature.position.x * TILE_SIZE;
    const worldY = creature.position.y * TILE_SIZE;

    const container = this.add.container(worldX, worldY);

    // Shadow
    const shadow = this.add.ellipse(0, 12, 24, 8, 0x000000, 0.3);
    container.add(shadow);

    // Background glow
    const bg = this.add.graphics();
    bg.fillStyle(isOwn ? 0x4c6ef5 : 0x6b7280, 0.6);
    bg.fillCircle(0, 0, 18);
    if (isOwn) {
      bg.lineStyle(2, 0x748ffc, 1);
      bg.strokeCircle(0, 0, 18);
    }
    container.add(bg);

    // Emoji
    const emoji = this.add.text(0, 0, creature.emoji, {
      fontSize: '20px',
      align: 'center',
    }).setOrigin(0.5);
    container.add(emoji);

    // Name tag
    const nameTag = this.add.text(0, -28, creature.name, {
      fontSize: '8px',
      fontFamily: 'Inter',
      color: isOwn ? '#93c5fd' : '#d1d5db',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    container.add(nameTag);

    // Owner username
    const label = this.add.text(0, 26, `@${creature.ownerUsername}`, {
      fontSize: '7px',
      fontFamily: 'Inter',
      color: '#9ca3af',
    }).setOrigin(0.5);
    container.add(label);

    container.setDepth(isOwn ? 100 : 50);

    // Floating animation for own creature
    if (isOwn) {
      this.tweens.add({
        targets: emoji,
        y: -4,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return {
      container,
      bg,
      label,
      emoji,
      nameTag,
      creatureId: creature.id,
      targetX: worldX,
      targetY: worldY,
    };
  }

  private updateCreaturesInChunk(chunk: Chunk): void {
    chunk.creatures.forEach((c) => {
      if (!this.creatureSprites.has(c.id)) {
        const sprite = this.createCreatureSprite(c as Creature);
        this.creatureSprites.set(c.id, sprite);
      }
    });
  }

  private updateCreaturePositions(): void {
    const lerpFactor = 0.15;

    for (const [, sprite] of this.creatureSprites) {
      const dx = sprite.targetX - sprite.container.x;
      const dy = sprite.targetY - sprite.container.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        sprite.container.x += dx * lerpFactor;
        sprite.container.y += dy * lerpFactor;
      }
    }

    if (this.myCreatureSprite) {
      const dx = this.myCreatureSprite.targetX - this.myCreatureSprite.container.x;
      const dy = this.myCreatureSprite.targetY - this.myCreatureSprite.container.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        this.myCreatureSprite.container.x += dx * lerpFactor;
        this.myCreatureSprite.container.y += dy * lerpFactor;
      }
    }
  }

  // ── Camera Utils ──────────────────────────────────────────
  private centerOnMyCreature(): void {
    const { myCreature } = useGameStore.getState();
    if (!myCreature) return;
    const worldX = myCreature.position.x * TILE_SIZE;
    const worldY = myCreature.position.y * TILE_SIZE;
    this.tweens.add({
      targets: this.cam,
      scrollX: worldX - this.cam.width / 2 / this.cam.zoom,
      scrollY: worldY - this.cam.height / 2 / this.cam.zoom,
      duration: 500,
      ease: 'Cubic.easeOut',
    });
  }

  update(_time: number, _delta: number): void {
    // Smooth zoom
    if (Math.abs(this.cam.zoom - this.targetZoom) > 0.001) {
      this.cam.zoom += (this.targetZoom - this.cam.zoom) * 0.1;
    }

    // Expose camera state to React
    const evt = new CustomEvent('game:camera_update', {
      detail: {
        scrollX: this.cam.scrollX,
        scrollY: this.cam.scrollY,
        zoom: this.cam.zoom,
      },
    });
    window.dispatchEvent(evt);
  }
}
