import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LandController } from './land.controller';

import {
  Land,
  LandSchema,
} from './schemas/land.schema';

import {
  SatelliteObservation,
  SatelliteObservationSchema,
} from './schemas/satellite-observation.schema';

import { EarthEngineService } from './services/earth-engine.service';
import { GeojsonService } from './services/geojson.service';
import { LandService } from './services/land.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Land.name,
        schema: LandSchema,
      },
      {
        name: SatelliteObservation.name,
        schema:
          SatelliteObservationSchema,
      },
    ]),
  ],

  controllers: [
    LandController,
  ],

  providers: [
    LandService,
    GeojsonService,
    EarthEngineService,
  ],
})
export class LandModule {}