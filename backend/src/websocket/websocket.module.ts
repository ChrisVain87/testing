import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GameGateway } from './game.gateway';
import { AuthModule } from '../auth/auth.module';
import { SimulationModule } from '../simulation/simulation.module';
import { MapModule } from '../map/map.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AuthModule,
    SimulationModule,
    MapModule,
  ],
  providers: [GameGateway],
})
export class WebSocketModule {}
