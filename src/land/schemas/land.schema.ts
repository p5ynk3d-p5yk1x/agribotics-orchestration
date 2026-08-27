import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  PointGeometry,
  PolygonGeometry,
} from '../services/geojson.service';

export type LandDocument = HydratedDocument<Land>;

@Schema({ collection: 'lands', timestamps: true })
export class Land {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true, type: Object })
  geometry!: PolygonGeometry;

  @Prop({ required: true })
  areaSqMeters!: number;

  @Prop({ required: true, type: Object })
  centroid!: PointGeometry;

  @Prop()
  lastSatelliteQueryAt?: Date;

  @Prop({ required: true, index: true })
  nextSatelliteRefreshAt!: Date;
}

export const LandSchema = SchemaFactory.createForClass(Land);
LandSchema.index({ geometry: '2dsphere' });
