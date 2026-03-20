import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CreaturesModule } from './creatures/creatures.module';
import { MapModule } from './map/map.module';
import { LLMModule } from './llm/llm.module';
import { SimulationModule } from './simulation/simulation.module';
import { WebSocketModule } from './websocket/websocket.module';
import { ModerationModule } from './moderation/moderation.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 60000, // 1 minute
            limit: config.get('THROTTLE_LIMIT', 60),
          },
          {
            name: 'long',
            ttl: 3600000, // 1 hour
            limit: 1000,
          },
        ],
      }),
    }),

    // Scheduling (cron jobs)
    ScheduleModule.forRoot(),

    // Job queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),

    // Core modules
    DatabaseModule,
    AuthModule,
    CreaturesModule,
    MapModule,
    LLMModule,
    SimulationModule,
    WebSocketModule,
    ModerationModule,
  ],
})
export class AppModule {}
