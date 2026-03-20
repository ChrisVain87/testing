import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SimulationService } from '../simulation/simulation.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
  creatureId: string | null;
  username: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);
  private userSockets = new Map<string, AuthenticatedSocket>(); // userId -> socket

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly simulationService: SimulationService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ?? client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('jwt.secret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { creature: true },
      });

      if (!user || user.isBanned) {
        client.disconnect();
        return;
      }

      const authSocket = client as AuthenticatedSocket;
      authSocket.userId = user.id;
      authSocket.username = user.username;
      authSocket.creatureId = user.creature?.id ?? null;

      this.userSockets.set(user.id, authSocket);

      // Mark user online
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true, lastSeenAt: new Date() },
      });

      if (user.creature) {
        await this.prisma.creature.update({
          where: { id: user.creature.id },
          data: { isOnline: true },
        });

        // Add to simulation
        this.simulationService.addCreatureToSimulation(user.creature);

        // Join creature-specific room
        client.join(`creature:${user.creature.id}`);
        // Join chunk room based on creature position
        const chunkKey = `${user.creature.chunkX},${user.creature.chunkY}`;
        client.join(`chunk:${chunkKey}`);
      }

      this.logger.log(`Client connected: ${user.username} (${client.id})`);
    } catch (err) {
      this.logger.warn('Auth failed, disconnecting client:', err);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const authSocket = client as AuthenticatedSocket;
    if (!authSocket.userId) return;

    this.userSockets.delete(authSocket.userId);

    try {
      await this.prisma.user.update({
        where: { id: authSocket.userId },
        data: { isOnline: false },
      });

      if (authSocket.creatureId) {
        await this.prisma.creature.update({
          where: { id: authSocket.creatureId },
          data: { isOnline: false },
        });
        this.simulationService.removeCreatureFromSimulation(authSocket.creatureId);
      }
    } catch {}

    this.logger.log(`Client disconnected: ${authSocket.username} (${client.id})`);
  }

  @SubscribeMessage('subscribe:chunks')
  handleSubscribeChunks(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chunkKeys: string[] },
  ) {
    data.chunkKeys.forEach((key) => {
      client.join(`chunk:${key}`);
    });
  }

  @SubscribeMessage('unsubscribe:chunks')
  handleUnsubscribeChunks(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chunkKeys: string[] },
  ) {
    data.chunkKeys.forEach((key) => {
      client.leave(`chunk:${key}`);
    });
  }

  // ── Event Handlers ─────────────────────────────────────────

  @OnEvent('simulation.updates')
  handleSimulationUpdates(updates: Array<{ creatureId: string; posX?: number; posY?: number; stats?: any }>) {
    // Batch emit to relevant rooms
    const chunkGroups = new Map<string, any[]>();

    for (const update of updates) {
      const chunkX = Math.floor((update.posX ?? 0) / 64);
      const chunkY = Math.floor((update.posY ?? 0) / 64);
      const key = `${chunkX},${chunkY}`;

      if (!chunkGroups.has(key)) chunkGroups.set(key, []);
      chunkGroups.get(key)!.push({
        creatureId: update.creatureId,
        position: update.posX !== undefined ? {
          x: update.posX,
          y: update.posY,
          chunkX,
          chunkY,
        } : undefined,
        stats: update.stats,
      });
    }

    for (const [chunkKey, chunkUpdates] of chunkGroups) {
      this.server.to(`chunk:${chunkKey}`).emit('creature:update', chunkUpdates);
    }
  }

  @OnEvent('world.event')
  handleWorldEvent(event: any) {
    // Broadcast to relevant chunk room
    const chunkKey = `${event.chunkX},${event.chunkY}`;
    this.server.to(`chunk:${chunkKey}`).emit('chunk:update', {
      chunkX: event.chunkX,
      chunkY: event.chunkY,
    });

    // Broadcast notable events globally
    const notableTypes = ['biome_invented', 'level_up', 'battle', 'alliance'];
    if (notableTypes.includes(event.type)) {
      this.server.emit('world:event', {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
    }
  }

  @OnEvent('llm.plan_ready')
  handlePlanReady(data: { creatureId: string; plan: any }) {
    this.server.to(`creature:${data.creatureId}`).emit('creature:prompt_executed', {
      plan: data.plan,
    });
  }

  // Notify owner when cooldown ends
  @OnEvent('cooldown.ended')
  handleCooldownEnded(data: { creatureId: string; ownerId: string }) {
    const ownerSocket = this.userSockets.get(data.ownerId);
    if (ownerSocket) {
      ownerSocket.emit('cooldown:ended');
    }
  }
}
