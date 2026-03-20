import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import type { WSCreatureUpdate, WSChunkUpdate, WSGlobalEvent } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(): void {
    if (this.socket?.connected) return;

    const { tokens } = useAuthStore.getState();

    this.socket = io(SOCKET_URL, {
      auth: { token: tokens?.accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.registerEventHandlers();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private registerEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      useGameStore.getState().addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Connected to the world server',
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      if (reason !== 'io client disconnect') {
        useGameStore.getState().addNotification({
          type: 'warning',
          title: 'Disconnected',
          message: 'Connection lost. Reconnecting...',
        });
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      this.reconnectAttempts++;
    });

    // Game events
    this.socket.on('creature:update', (data: WSCreatureUpdate) => {
      useGameStore.getState().applyCreatureUpdate(data);
    });

    this.socket.on('chunk:update', (data: WSChunkUpdate) => {
      useGameStore.getState().applyChunkUpdate(data);
    });

    this.socket.on('world:event', (data: WSGlobalEvent) => {
      const store = useGameStore.getState();
      store.addGlobalEvent(data);

      // Notify player about notable events
      if (data.type === 'biome_invented') {
        store.addNotification({
          type: 'event',
          title: `New Biome Invented! 🌍`,
          message: `${data.creatureName} invented "${(data.details as { biomeName?: string }).biomeName}"`,
        });
      } else if (data.type === 'battle' && data.creatureId === store.myCreature?.id) {
        store.addNotification({
          type: 'warning',
          title: 'Under Attack!',
          message: `You are being attacked by ${(data.details as { attackerName?: string }).attackerName}`,
        });
      } else if (data.type === 'level_up' && data.creatureId === store.myCreature?.id) {
        store.addNotification({
          type: 'success',
          title: 'Level Up! 🎉',
          message: `Your creature reached level ${(data.details as { level?: number }).level}!`,
        });
      }
    });

    this.socket.on('creature:prompt_executed', (data: { plan: unknown }) => {
      const store = useGameStore.getState();
      store.addNotification({
        type: 'info',
        title: 'New Plan Active',
        message: 'Your creature has received its new behavior plan',
      });
      if (store.myCreature) {
        store.updateMyCreature({ currentBehaviorPlan: data.plan as never });
      }
    });

    this.socket.on('cooldown:ended', () => {
      const store = useGameStore.getState();
      store.addNotification({
        type: 'success',
        title: 'Prompt Ready!',
        message: 'You can now update your creature\'s system prompt',
      });
      if (store.myCreature) {
        store.updateMyCreature({ promptCooldownEndsAt: null });
      }
    });
  }

  // Subscribe to specific chunks for real-time updates
  subscribeToChunks(chunkKeys: string[]): void {
    this.socket?.emit('subscribe:chunks', { chunkKeys });
  }

  unsubscribeFromChunks(chunkKeys: string[]): void {
    this.socket?.emit('unsubscribe:chunks', { chunkKeys });
  }

  // Send player action (for rare direct interactions)
  emit(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
