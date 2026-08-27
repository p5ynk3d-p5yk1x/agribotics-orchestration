import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

import { KafkaTopics } from '../constants/jobs.kafka-topics';
import { JobCreatedEvent } from '../dtos/kafka/job-created.event';
import { JobType } from '../enums/job-type.enum';

@Injectable()
export class JobsProducer {
  private readonly logger = new Logger(JobsProducer.name);

  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  async emitJobCreated(event: JobCreatedEvent) {
    const topic =
      event.jobType === JobType.WEED
        ? KafkaTopics.WEED_JOB_CREATED
        : event.jobType === JobType.SOIL
          ? KafkaTopics.SOIL_JOB_CREATED
          : KafkaTopics.DISEASE_JOB_CREATED;

    this.logger.log(
      `Publishing JobCreatedEvent -> topic=${topic}, jobId=${event.jobId}, userId=${event.userId}, jobType=${event.jobType}`,
    );

    await this.kafka.emit(topic, event);

    this.logger.log(
      `Successfully published JobCreatedEvent -> topic=${topic}, jobId=${event.jobId}`,
    );
  }
}