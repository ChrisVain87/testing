import { create } from 'zustand';
import type { Creature, Chunk, Notification, CustomBiome, WSCreatureUpdate, WSChunkUpdate, WSGlobalEvent } from '../types';

interface NearbyCreature {
  id: string;
  name: string;
  emoji: string;
  position: { x: number; y: number; chunkX: number; chunkY: number };
  ownerUsername: string;
}

interface GameState {
  // My creature
  myCreature: Creature | null;

  // Loaded map chunks
  chunks: Map<string, Chunk>;

  // Nearby creatures (within visible range)
  nearbyCreatures: Map<string, NearbyCreature>;

  // UI state
  sidebarOpen: boolean;
  sidebarTab: 'creature' | 'map' | 'leaderboard' | 'memories';
  activeModal: 'none' | 'prompt' | 'settings' | 'tutorial' | 'create-creature' | 'creature-info';
  selectedCreatureId: string | null;
  cameraTarget: { x: number; y: number } | null;

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Global events feed
  globalEvents: WSGlobalEvent[];

  // Top biomes
  topBiomes: CustomBiome[];

  // Actions
  setMyCreature: (creature: Creature | null) => void;
  updateMyCreature: (update: Partial<Creature>) => void;
  setChunk: (chunkKey: string, chunk: Chunk) => void;
  removeChunk: (chunkKey: string) => void;
  applyCreatureUpdate: (update: WSCreatureUpdate) => void;
  applyChunkUpdate: (update: WSChunkUpdate) => void;
  addGlobalEvent: (event: WSGlobalEvent) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: GameState['sidebarTab']) => void;
  setActiveModal: (modal: GameState['activeModal']) => void;
  setSelectedCreatureId: (id: string | null) => void;
  setCameraTarget: (target: { x: number; y: number } | null) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationsRead: () => void;
  setTopBiomes: (biomes: CustomBiome[]) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  myCreature: null,
  chunks: new Map(),
  nearbyCreatures: new Map(),
  sidebarOpen: true,
  sidebarTab: 'creature',
  activeModal: 'none',
  selectedCreatureId: null,
  cameraTarget: null,
  notifications: [],
  unreadCount: 0,
  globalEvents: [],
  topBiomes: [],

  setMyCreature: (creature) => set({ myCreature: creature }),

  updateMyCreature: (update) => {
    const { myCreature } = get();
    if (myCreature) {
      set({ myCreature: { ...myCreature, ...update } });
    }
  },

  setChunk: (chunkKey, chunk) => {
    const chunks = new Map(get().chunks);
    chunks.set(chunkKey, chunk);
    // Keep max 200 chunks in memory
    if (chunks.size > 200) {
      const firstKey = chunks.keys().next().value;
      if (firstKey) chunks.delete(firstKey);
    }
    set({ chunks });
  },

  removeChunk: (chunkKey) => {
    const chunks = new Map(get().chunks);
    chunks.delete(chunkKey);
    set({ chunks });
  },

  applyCreatureUpdate: (update) => {
    const { myCreature, nearbyCreatures } = get();

    if (myCreature && update.creatureId === myCreature.id) {
      const merged: Partial<Creature> = {};
      if (update.position) merged.position = update.position;
      if (update.stats) merged.stats = { ...myCreature.stats, ...update.stats };
      set({ myCreature: { ...myCreature, ...merged } });
    } else {
      const nearby = new Map(nearbyCreatures);
      const existing = nearby.get(update.creatureId);
      if (existing && update.position) {
        nearby.set(update.creatureId, { ...existing, position: update.position });
        set({ nearbyCreatures: nearby });
      }
    }
  },

  applyChunkUpdate: (update) => {
    const chunkKey = `${update.chunkX},${update.chunkY}`;
    const { chunks } = get();
    const existing = chunks.get(chunkKey);
    if (existing) {
      const merged: Chunk = { ...existing };
      if (update.tiles) {
        update.tiles.forEach((tile) => {
          merged.tiles[tile.y] = merged.tiles[tile.y] || [];
          merged.tiles[tile.y][tile.x] = tile;
        });
      }
      if (update.structures) merged.structures = update.structures;
      if (update.creatures) {
        const nearbyMap = new Map(get().nearbyCreatures);
        update.creatures.forEach((c) => {
          nearbyMap.set(c.id, c as NearbyCreature);
        });
        set({ nearbyCreatures: nearbyMap });
      }
      const newChunks = new Map(chunks);
      newChunks.set(chunkKey, merged);
      set({ chunks: newChunks });
    }
  },

  addGlobalEvent: (event) => {
    const { globalEvents } = get();
    set({ globalEvents: [event, ...globalEvents].slice(0, 100) });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSelectedCreatureId: (id) => set({ selectedCreatureId: id }),
  setCameraTarget: (target) => set({ cameraTarget: target }),

  addNotification: (notif) => {
    const notification: Notification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const { notifications, unreadCount } = get();
    set({
      notifications: [notification, ...notifications].slice(0, 50),
      unreadCount: unreadCount + 1,
    });
  },

  markNotificationsRead: () => {
    const { notifications } = get();
    set({
      notifications: notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    });
  },

  setTopBiomes: (biomes) => set({ topBiomes: biomes }),
}));
