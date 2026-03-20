// ============================================================
// Shared types between frontend and backend
// ============================================================

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'xai';

export type CreaturePreset =
  | 'blobbo' | 'fuzzling' | 'snorkle' | 'zipplet' | 'gloomp'
  | 'wobblo' | 'squidlet' | 'boomba' | 'fluffnik' | 'crinkle'
  | 'plonker' | 'zazzle';

export interface CreatureStats {
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
  experienceToNext: number;
}

export interface CreaturePosition {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
}

export interface Creature {
  id: string;
  name: string;
  preset: CreaturePreset;
  colorVariant: number;
  emoji: string;
  ownerId: string;
  ownerUsername: string;
  position: CreaturePosition;
  stats: CreatureStats;
  systemPrompt: string;
  currentBehaviorPlan: BehaviorPlan | null;
  promptCooldownEndsAt: string | null; // ISO date
  lastLLMCallAt: string | null;
  totalTilesOwned: number;
  totalStructures: number;
  biomeInventions: number;
  alliances: string[]; // creature IDs
  createdAt: string;
  isOnline: boolean;
}

export interface BehaviorPlan {
  actions: ActionPlan[];
  summary: string;
  personality: string;
  goal: string;
  generatedAt: string;
  expiresAt: string;
}

export type ActionType =
  | 'move_to'
  | 'claim_land'
  | 'build_structure'
  | 'terraform_tile'
  | 'interact'
  | 'explore'
  | 'invent_new_biome'
  | 'gather_resources'
  | 'rest';

export interface ActionPlan {
  type: ActionType;
  priority: number;
  params: Record<string, unknown>;
  completed: boolean;
}

export type TileType =
  | 'grass' | 'forest' | 'mountain' | 'water' | 'desert' | 'snow'
  | 'swamp' | 'lava' | 'crystal' | 'void' | 'candy' | 'neon'
  | 'custom';

export type StructureType =
  | 'hut' | 'tower' | 'bridge' | 'wall' | 'farm' | 'mine'
  | 'library' | 'market' | 'portal' | 'beacon' | 'custom';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  customName?: string;
  customColor?: number;
  customProperties?: Record<string, unknown>;
  ownerId?: string; // creature ID
  ownerUsername?: string;
  structureId?: string;
}

export interface Structure {
  id: string;
  type: StructureType;
  customName?: string;
  ownerId: string;
  posX: number;
  posY: number;
  level: number;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface Chunk {
  x: number;
  y: number;
  tiles: Tile[][];
  structures: Structure[];
  creatures: Pick<Creature, 'id' | 'name' | 'emoji' | 'position' | 'ownerUsername'>[];
  lastModified: string;
}

export interface CustomBiome {
  id: string;
  name: string;
  tileType: string;
  color: number;
  rules: Record<string, unknown>;
  inventedBy: string; // creature ID
  inventedByName: string;
  description: string;
  popularity: number;
  createdAt: string;
}

export interface CreatureMemory {
  id: string;
  creatureId: string;
  content: string;
  importance: number;
  category: 'exploration' | 'combat' | 'building' | 'social' | 'discovery' | 'economy';
  relatedCreatureIds: string[];
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  creature: Creature | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================================
// WebSocket events
// ============================================================

export interface WSCreatureUpdate {
  creatureId: string;
  position?: CreaturePosition;
  stats?: Partial<CreatureStats>;
  action?: {
    type: ActionType;
    params: Record<string, unknown>;
  };
}

export interface WSChunkUpdate {
  chunkX: number;
  chunkY: number;
  tiles?: Tile[];
  structures?: Structure[];
  creatures?: Pick<Creature, 'id' | 'name' | 'emoji' | 'position'>[];
}

export interface WSGlobalEvent {
  type: 'biome_invented' | 'structure_built' | 'land_claimed' | 'battle' | 'alliance' | 'level_up';
  creatureId: string;
  creatureName: string;
  details: Record<string, unknown>;
  position: CreaturePosition;
  timestamp: string;
}

// ============================================================
// API request/response types
// ============================================================

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateCreatureRequest {
  name: string;
  preset: CreaturePreset;
  colorVariant: number;
  llmProvider: LLMProvider;
  apiKey: string;
  systemPrompt: string;
}

export interface UpdatePromptRequest {
  systemPrompt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================
// UI state types
// ============================================================

export interface GameUIState {
  selectedCreatureId: string | null;
  hoveredTile: { x: number; y: number } | null;
  sidebarOpen: boolean;
  sidebarTab: 'creature' | 'map' | 'leaderboard' | 'memories';
  modalOpen: 'none' | 'prompt' | 'alliance' | 'settings' | 'tutorial';
  cameraPosition: { x: number; y: number; zoom: number };
  miniMapVisible: boolean;
  notificationsVisible: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'event';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// Creature preset definitions
export const CREATURE_PRESETS: Record<CreaturePreset, {
  name: string;
  emoji: string;
  description: string;
  baseStats: Partial<CreatureStats>;
}> = {
  blobbo: { name: 'Blobbo', emoji: '🫧', description: 'A cheerful blob that loves water and swamps', baseStats: { speed: 1.2, maxHealth: 120 } },
  fuzzling: { name: 'Fuzzling', emoji: '🦔', description: 'Fluffy and defensive, great at building walls', baseStats: { maxHealth: 150, speed: 0.8 } },
  snorkle: { name: 'Snorkle', emoji: '🐊', description: 'Sneaky explorer that claims land quickly', baseStats: { speed: 1.5, maxEnergy: 120 } },
  zipplet: { name: 'Zipplet', emoji: '⚡', description: 'Lightning-fast but fragile energy collector', baseStats: { speed: 2.0, maxHealth: 80 } },
  gloomp: { name: 'Gloomp', emoji: '🌿', description: 'Nature lover that grows forests and farms', baseStats: { maxFood: 150, maxMaterials: 150 } },
  wobblo: { name: 'Wobblo', emoji: '🐙', description: 'Multi-armed builder that creates complex structures', baseStats: { maxMaterials: 200, speed: 0.9 } },
  squidlet: { name: 'Squidlet', emoji: '🦑', description: 'Ink-spraying artist that terraforms creatively', baseStats: { maxEnergy: 150, speed: 1.1 } },
  boomba: { name: 'Boomba', emoji: '💣', description: 'Explosive fighter that loves PvP combat', baseStats: { maxHealth: 180, speed: 0.7 } },
  fluffnik: { name: 'Fluffnik', emoji: '🐰', description: 'Social butterfly that forms alliances easily', baseStats: { maxHealth: 100, speed: 1.3 } },
  crinkle: { name: 'Crinkle', emoji: '🦎', description: 'Adaptable chameleon that invents new biomes', baseStats: { maxEnergy: 200, speed: 1.0 } },
  plonker: { name: 'Plonker', emoji: '🐸', description: 'Lucky treasure hunter that finds rare resources', baseStats: { maxFood: 200, maxMaterials: 100 } },
  zazzle: { name: 'Zazzle', emoji: '🌟', description: 'Mysterious star being with balanced stats', baseStats: { maxHealth: 130, maxEnergy: 130, speed: 1.1 } },
};

export const LLM_PROVIDERS: Record<LLMProvider, { name: string; models: string[]; color: string }> = {
  openai: { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], color: '#10a37f' },
  anthropic: { name: 'Claude (Anthropic)', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], color: '#d4a26a' },
  google: { name: 'Gemini (Google)', models: ['gemini-2.0-flash', 'gemini-1.5-pro'], color: '#4285f4' },
  xai: { name: 'Grok (xAI)', models: ['grok-2', 'grok-2-mini'], color: '#ffffff' },
};

export const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4ade80,
  forest: 0x166534,
  mountain: 0x6b7280,
  water: 0x3b82f6,
  desert: 0xfbbf24,
  snow: 0xe2e8f0,
  swamp: 0x4d7c0f,
  lava: 0xef4444,
  crystal: 0xc084fc,
  void: 0x1e1b4b,
  candy: 0xf9a8d4,
  neon: 0x22d3ee,
  custom: 0xffffff,
};

export const STRUCTURE_EMOJIS: Record<StructureType, string> = {
  hut: '🏠',
  tower: '🗼',
  bridge: '🌉',
  wall: '🧱',
  farm: '🌾',
  mine: '⛏️',
  library: '📚',
  market: '🏪',
  portal: '🌀',
  beacon: '🔦',
  custom: '✨',
};
