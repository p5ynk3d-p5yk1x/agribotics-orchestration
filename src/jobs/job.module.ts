import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';

import { KafkaModule } from './kafka/kafka.module';

import { Job, JobSchema } from './schemas/job.schema';
import { JobResult, JobResultSchema } from './schemas/job-result.schema';

import { JobsController } from './job.controllers';
import { JobsService } from './services/jobs.service';

import { JobsProducer } from './kafka/jobs.producer';
import { JobsConsumer } from './kafka/jobs.consumer';

@Module({
  imports: [
    AuthModule,
    KafkaModule,
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: JobResult.name, schema: JobResultSchema }
    ])
  ],
  controllers: [JobsController, JobsConsumer],
  providers: [
    JobsService,
    JobsProducer,
  ]
})
export class JobsModule {}