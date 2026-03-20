import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';
import type {
  User,
  Creature,
  AuthTokens,
  RegisterRequest,
  LoginRequest,
  CreateCreatureRequest,
  UpdatePromptRequest,
  Chunk,
  CustomBiome,
  CreatureMemory,
  PaginatedResponse,
  ApiResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor - attach access token
    this.client.interceptors.request.use((config) => {
      const { tokens } = useAuthStore.getState();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
      return config;
    });

    // Response interceptor - handle 401 and refresh
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const { tokens } = useAuthStore.getState();
            if (tokens?.refreshToken) {
              const res = await axios.post<ApiResponse<AuthTokens>>(
                `${BASE_URL}/auth/refresh`,
                { refreshToken: tokens.refreshToken },
              );
              useAuthStore.getState().setTokens(res.data.data);
              original.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
              return this.client(original);
            }
          } catch {
            useAuthStore.getState().logout();
          }
        }
        return Promise.reject(error);
      },
    );
  }

  // ── Auth ──────────────────────────────────────────────────
  async register(body: RegisterRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const res = await this.client.post('/auth/register', body);
    return res.data;
  }

  async login(body: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const res = await this.client.post('/auth/login', body);
    return res.data;
  }

  async getMe(): Promise<ApiResponse<User>> {
    const res = await this.client.get('/auth/me');
    return res.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  // ── Creatures ─────────────────────────────────────────────
  async createCreature(body: CreateCreatureRequest): Promise<ApiResponse<Creature>> {
    const res = await this.client.post('/creatures', body);
    return res.data;
  }

  async getMyCreature(): Promise<ApiResponse<Creature>> {
    const res = await this.client.get('/creatures/me');
    return res.data;
  }

  async getCreature(id: string): Promise<ApiResponse<Creature>> {
    const res = await this.client.get(`/creatures/${id}`);
    return res.data;
  }

  async updatePrompt(body: UpdatePromptRequest): Promise<ApiResponse<{ cooldownEndsAt: string }>> {
    const res = await this.client.patch('/creatures/me/prompt', body);
    return res.data;
  }

  async getLeaderboard(page = 1, limit = 20): Promise<PaginatedResponse<Creature>> {
    const res = await this.client.get('/creatures/leaderboard', { params: { page, limit } });
    return res.data;
  }

  async getNearbyCreatures(): Promise<ApiResponse<Creature[]>> {
    const res = await this.client.get('/creatures/me/nearby');
    return res.data;
  }

  // ── Map ───────────────────────────────────────────────────
  async getChunk(chunkX: number, chunkY: number): Promise<ApiResponse<Chunk>> {
    const res = await this.client.get(`/map/chunks/${chunkX}/${chunkY}`);
    return res.data;
  }

  async getChunks(
    chunkXs: number[],
    chunkYs: number[],
  ): Promise<ApiResponse<Chunk[]>> {
    const res = await this.client.post('/map/chunks/batch', { chunkXs, chunkYs });
    return res.data;
  }

  async getTopBiomes(limit = 20): Promise<ApiResponse<CustomBiome[]>> {
    const res = await this.client.get('/map/biomes/top', { params: { limit } });
    return res.data;
  }

  // ── Memories ──────────────────────────────────────────────
  async getMyMemories(page = 1, limit = 20): Promise<PaginatedResponse<CreatureMemory>> {
    const res = await this.client.get('/creatures/me/memories', { params: { page, limit } });
    return res.data;
  }

  // ── Admin / Moderation ────────────────────────────────────
  async reportCreature(creatureId: string, reason: string): Promise<void> {
    await this.client.post('/moderation/report', { creatureId, reason });
  }
}

export const api = new ApiService();
