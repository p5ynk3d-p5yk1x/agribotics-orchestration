import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';

export type JobDocument = HydratedDocument<Job>;

@Schema({ collection: 'jobs',timestamps: true })
export class Job {
  @Prop({
    required: true,
    unique: true,
    index: true,
    default: uuid,
  })
  jobId!: string;

  @Prop({ required: true,index: true })
  userId!: string;

  @Prop({
    required: true,
    enum: Object.values(JobType),
  })
  jobType!: JobType;

  @Prop({
    required: true,
    enum: Object.values(JobStatus),
    default: JobStatus.QUEUED,
  })
  status!: JobStatus;

  @Prop()
  imagePath?: string;

  @Prop()
  failureReason?: string;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ status: 1 });
JobSchema.index({ createdAt: -1 });