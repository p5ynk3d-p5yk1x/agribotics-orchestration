import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

import { KafkaTopics } from '../constants/jobs.kafka-topics';
import { JobCreatedEvent } from '../dtos/kafka/job-created.event';
import { JobType } from '../enums/job-type.enum';
import { SoilJobCreatedEvent } from '../dtos/kafka/soil-job-created.event';

@Injectable()
export class JobsProducer {
  private readonly logger = new Logger(JobsProducer.name);

  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  async emitJobCreated(event: JobCreatedEvent) {
    const topic =event.jobType === JobType.WEED ? KafkaTopics.WEED_JOB_CREATED : KafkaTopics.DISEASE_JOB_CREATED;
    this.logger.log(`Publishing JobCreatedEvent -> topic=${topic}, jobId=${event.jobId}, userId=${event.userId}, jobType=${event.jobType}`,);
    switch (event.jobType) {
      case JobType.WEED:
        await this.kafka.emit(KafkaTopics.WEED_JOB_CREATED,event);
        this.logger.log(`Successfully published JobCreatedEvent -> topic=${topic}, jobId=${event.jobId}`,);
        return;
      case JobType.DISEASE:
        await this.kafka.emit(KafkaTopics.DISEASE_JOB_CREATED,event);
        this.logger.log(`Successfully published JobCreatedEvent -> topic=${topic}, jobId=${event.jobId}`,);
        return;
    }
  }
  async emitSoilJobCreated(event: SoilJobCreatedEvent) {
    this.logger.log(`Publishing JobCreatedEvent -> topic=${KafkaTopics.SOIL_JOB_CREATED}, jobId=${event.jobId}, userId=${event.userId}, jobType=${event.jobType}`,);
    await this.kafka.emit(KafkaTopics.SOIL_JOB_CREATED,event);
    this.logger.log(`Successfully published JobCreatedEvent -> topic=${KafkaTopics.SOIL_JOB_CREATED}, jobId=${event.jobId}`,);
  }
}