import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SoilJobDocument = HydratedDocument<SoilJob>;

@Schema({ collection: 'soil_jobs',timestamps: true })
export class SoilJob {
  @Prop({ required: true,unique: true,index: true })
  jobId!: string;

  @Prop({ required: true,index: true })
  userId!: string;

  @Prop({ required: true,type: Number })
  latitude!: number;

  @Prop({ required: true,type: Number })
  longitude!: number;

  @Prop({ required: true,type: Number })
  nitrogenLevel!: number;

  @Prop({ required: true,type: Number })
  potassiumLevel!: number;

  @Prop({ required: true,type: Number })
  phosphorousLevel!: number;

  @Prop({ required: true,type: Number })
  organicCarbonLevel!: number;

  @Prop({ type: Number })
  ironLevel?: number;

  @Prop({ type: Number })
  zincLevel?: number;

  @Prop({ type: Number })
  manganeseLevel?: number;

  @Prop({ type: Number })
  copperLevel?: number;

  @Prop({ type: Number })
  boronLevel?: number;

  @Prop({ type: Number })
  sulphurLevel?: number;

  @Prop({ type: Number })
  salinityLevel?: number;

  @Prop({ type: Number })
  electricalConductivity?: number;

  @Prop({ type: Number,min: 0,max: 14 })
  pH?: number;
}

export const SoilJobSchema = SchemaFactory.createForClass(SoilJob);

SoilJobSchema.index({ userId: 1,createdAt: -1 });