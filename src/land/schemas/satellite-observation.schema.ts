import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  SatelliteDataset,
  SatelliteObservationStatus,
  SatelliteProvider,
} from '../enums/satellite.enum';

export type SatelliteObservationDocument =
  HydratedDocument<SatelliteObservation>;

@Schema({ collection: 'satellite_observations', timestamps: true })
export class SatelliteObservation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Land', index: true })
  landId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: Object.values(SatelliteProvider) })
  provider!: SatelliteProvider;

  @Prop({ required: true, enum: Object.values(SatelliteDataset) })
  dataset!: SatelliteDataset;

  @Prop({ required: true, index: true })
  observationTime!: Date;

  @Prop({ required: true, index: true })
  retrievedAt!: Date;

  @Prop()
  cloudPercentage?: number;

  @Prop({ required: true, type: Object, default: {} })
  indices!: { ndvi?: number };

  @Prop({ required: true, type: Object, default: {} })
  metrics!: Record<string, unknown>;

  @Prop({ required: true, type: Object, default: {} })
  sourceMetadata!: Record<string, unknown>;

  @Prop({ required: true, default: 1 })
  queryVersion!: number;

  @Prop({ required: true, enum: Object.values(SatelliteObservationStatus) })
  status!: SatelliteObservationStatus;
}

export const SatelliteObservationSchema =
  SchemaFactory.createForClass(SatelliteObservation);
SatelliteObservationSchema.index({ landId: 1, observationTime: -1 });
SatelliteObservationSchema.index({ landId: 1, retrievedAt: -1 });
