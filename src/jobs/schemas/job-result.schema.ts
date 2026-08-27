import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { JobType } from '../enums/job-type.enum';

export type JobResultDocument = HydratedDocument<JobResult>;

@Schema({collection: 'job_results',timestamps: true})
export class JobResult {

  @Prop({ required: true, unique: true, index: true })
  jobId!: string;

  @Prop({required: true,enum: Object.values(JobType)})
  jobType!: JobType;

  @Prop({type: SchemaTypes.Mixed,required: true})
  resultPayload!: Record<string, any>;
}

export const JobResultSchema = SchemaFactory.createForClass(JobResult);
