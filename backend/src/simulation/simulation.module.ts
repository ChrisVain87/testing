import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { MapModule } from '../map/map.module';
import { CreaturesModule } from '../creatures/creatures.module';

@Module({
  imports: [MapModule, CreaturesModule],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
