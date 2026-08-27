import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuid } from 'uuid';

import { Job, JobDocument } from '../schemas/job.schema';
import { JobResult, JobResultDocument } from '../schemas/job-result.schema';

import { JobType } from '../enums/job-type.enum';
import { JobStatus } from '../enums/job-status.enum';

import { JobCreatedEvent } from '../dtos/kafka/job-created.event';
import { JobStatusUpdatedEvent } from '../dtos/kafka/job-status-updated.event';

import { JobsProducer } from '../kafka/jobs.producer';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobResult.name) private readonly resultModel: Model<JobResultDocument>,
    private readonly producer: JobsProducer
  ) {}

  async createJob(userId: string, jobType: JobType, imagePath: string) {
    const job = await this.jobModel.create({
      userId,
      jobType,
      imagePath,
      status: JobStatus.QUEUED,
    });

    const event: JobCreatedEvent = {
      jobId: job.jobId,
      userId,
      jobType,
      imagePath,
      createdAt: new Date().toISOString(),
    };

    this.logger.log(
      `Creating job for user=${userId}, jobType=${jobType}, imagePath=${imagePath}`,
    );

    await this.producer.emitJobCreated(event);

    this.logger.log(
      `Job created successfully. jobId=${job.jobId}, status=${job.status}`,
    );


    return {
      jobId: job.jobId,
      status: JobStatus.QUEUED
    };
  }

  async getJob(userId: string, jobId: string) {

    const job = await this.jobModel.findOne({ jobId });

    if (!job) throw new NotFoundException('Job not found');

    if (job.userId !== userId)
      throw new ForbiddenException('Not your job');

    if (job.status !== JobStatus.COMPLETED)
      return job;

    const result = await this.resultModel.findOne({ jobId });

    return {
      ...job.toObject(),
      result: result?.resultPayload ?? null
    };
  }
  async getJobsByType(userId: string, jobType: JobType) {
    return this.jobModel
      .find({
        userId,
        jobType,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async handleStatusUpdate(event: JobStatusUpdatedEvent) {

    const job = await this.jobModel.findOne({ jobId: event.jobId });

    if (!job) return;

    job.status = event.status;

    if (event.failureReason){
      job.failureReason = event.failureReason;
      console.log(event.failureReason)
    }
    await job.save();

    if (
      event.status === JobStatus.COMPLETED &&
      event.resultPayload
    ) {
      await this.resultModel.findOneAndUpdate(
        { jobId: event.jobId },
        {
          jobId: event.jobId,
          jobType: event.jobType,
          resultPayload: event.resultPayload
        },
        {
          upsert: true,
          new: true
        }
      );
    }
  }
}