import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { S3StorageService } from '../../common/storage/s3.service';
import { CreateSoilJobDto } from '../dtos/create-soil-job.dto';
import { JobCreatedEvent } from '../dtos/kafka/job-created.event';
import { JobStatusUpdatedEvent } from '../dtos/kafka/job-status-updated.event';
import { SoilJobCreatedEvent } from '../dtos/kafka/soil-job-created.event';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { JobsProducer } from '../kafka/jobs.producer';
import { JobResult, JobResultDocument } from '../schemas/job-result.schema';
import { Job, JobDocument } from '../schemas/job.schema';
import { SoilJob, SoilJobDocument } from '../schemas/soil-job.schema';
import { Land, LandDocument } from '../../land/schemas/land.schema';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobResult.name) private readonly resultModel: Model<JobResultDocument>,
    @InjectModel(SoilJob.name) private readonly soilJobModel: Model<SoilJobDocument>,
    @InjectModel(Land.name) private readonly landModel: Model<LandDocument>,
    private readonly producer: JobsProducer,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async createJob(userId: string,jobType: JobType.WEED | JobType.DISEASE,file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image is required');

    const jobId = uuid();
    const imagePath = this.s3StorageService.getJobKey(jobType,jobId);

    await this.s3StorageService.upload(file,imagePath);

    try {
      const job = await this.jobModel.create({
        jobId,
        userId,
        jobType,
        imagePath,
        status: JobStatus.QUEUED,
      });

      const event: JobCreatedEvent = {
        jobId,
        userId,
        jobType,
        imagePath,
        createdAt: new Date().toISOString(),
      };

      this.logger.log(`Creating job for user=${userId}, jobType=${jobType}, imagePath=${imagePath}`);
      await this.producer.emitJobCreated(event);
      this.logger.log(`Job created successfully. jobId=${jobId}, status=${job.status}`);

      return {
        jobId,
        status: JobStatus.QUEUED,
      };
    } catch (error) {
      await this.s3StorageService.delete(imagePath).catch(() => undefined);
      throw error;
    }
  }

  async createSoilJob(userId: string,dto: CreateSoilJobDto) {
    const land = await this.landModel.findOne({ userId }).lean();
    if (!land) throw new BadRequestException('Land must be selected before creating a soil analysis job');

    const [longitude,latitude] = land.centroid.coordinates;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Land centroid is invalid');
    }

    const jobId = uuid();

    const job = await this.jobModel.create({
      jobId,
      userId,
      jobType: JobType.SOIL,
      status: JobStatus.QUEUED,
    });

    try {
      await this.soilJobModel.create({
        jobId,
        userId,
        latitude,
        longitude,
        ...dto,
      });

      const event: SoilJobCreatedEvent = {
        jobId,
        userId,
        jobType: JobType.SOIL,
        latitude,
        longitude,
        nitrogenLevel: dto.nitrogenLevel,
        potassiumLevel: dto.potassiumLevel,
        phosphorousLevel: dto.phosphorousLevel,
        organicCarbonLevel: dto.organicCarbonLevel,
        ironLevel: dto.ironLevel,
        zincLevel: dto.zincLevel,
        manganeseLevel: dto.manganeseLevel,
        copperLevel: dto.copperLevel,
        boronLevel: dto.boronLevel,
        sulphurLevel: dto.sulphurLevel,
        salinityLevel: dto.salinityLevel,
        electricalConductivity: dto.electricalConductivity,
        pH: dto.pH,
        createdAt: new Date().toISOString(),
      };

      this.logger.log(`Creating soil job for user=${userId}, jobId=${jobId}, latitude=${latitude}, longitude=${longitude}`);

      await this.producer.emitSoilJobCreated(event);

      this.logger.log(`Soil job created successfully. jobId=${jobId}, status=${job.status}`);

      return {
        jobId,
        status: JobStatus.QUEUED,
      };
    } catch (error) {
      await Promise.allSettled([
        this.soilJobModel.deleteOne({ jobId }),
        this.jobModel.deleteOne({ jobId }),
      ]);

      throw error;
    }
  }

  async getJob(userId: string,jobId: string) {
    const job = await this.jobModel.findOne({ jobId });
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId !== userId) throw new ForbiddenException('Not your job');

    const response = await this.withImageUrl(job.toObject());

    if (job.status !== JobStatus.COMPLETED) {
      return response;
    }

    const result = await this.resultModel.findOne({ jobId });

    return {
      ...response,
      result: result?.resultPayload ?? null,
    };
  }

  async getJobsByType(userId: string,jobType: JobType) {
    const jobs = await this.jobModel.find({ userId,jobType }).sort({ createdAt: -1 }).lean();

    return Promise.all(
      jobs.map((job) => this.withImageUrl(job)),
    );
  }

  async handleStatusUpdate(event: JobStatusUpdatedEvent) {
    const job = await this.jobModel.findOne({ jobId: event.jobId });
    if (!job) return;

    job.status = event.status;

    if (event.failureReason) {
      job.failureReason = event.failureReason;
      this.logger.error(event.failureReason);
    }

    await job.save();

    if (event.status === JobStatus.COMPLETED && event.resultPayload) {
      await this.resultModel.findOneAndUpdate(
        { jobId: event.jobId },
        {
          jobId: event.jobId,
          jobType: event.jobType,
          resultPayload: event.resultPayload,
        },
        {
          upsert: true,
          new: true,
        },
      );
    }
  }

  private async withImageUrl<T extends { imagePath?: string }>(job: T): Promise<T & { imageUrl?: string }> {
    if (!job.imagePath) return { ...job };

    return {
      ...job,
      imageUrl: await this.s3StorageService.createSignedUrl(job.imagePath),
    };
  }
}