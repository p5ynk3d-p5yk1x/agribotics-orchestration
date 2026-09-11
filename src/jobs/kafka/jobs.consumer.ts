import { Controller, Logger, OnModuleInit } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { EventPattern } from '@nestjs/microservices';

import { KafkaTopics } from '../constants/jobs.kafka-topics';
import * as jobStatusUpdatedEvent from '../dtos/kafka/job-status-updated.event';
import { JobsService } from '../services/jobs.service';

@Controller()
export class JobsConsumer implements OnModuleInit {
  private readonly logger = new Logger(JobsConsumer.name);
  constructor(private readonly jobsService: JobsService) {}

  onModuleInit() {
    this.logger.log('Kafka consumer initialized');
  }

  @EventPattern(KafkaTopics.WEED_STATUS_UPDATED)
  async handleWeedStatusUpdate(@Payload() event: jobStatusUpdatedEvent.JobStatusUpdatedEvent) {
    console.log(' WEED EVENT RECEIVED');
    console.log(JSON.stringify(event, null, 2));
    await this.jobsService.handleStatusUpdate(event);
  }

  @EventPattern(KafkaTopics.DISEASE_STATUS_UPDATED)
  async handleDiseaseStatusUpdate(@Payload() event: jobStatusUpdatedEvent.JobStatusUpdatedEvent) {
    console.log(' WEED EVENT RECEIVED');
    console.log(JSON.stringify(event, null, 2));
    await this.jobsService.handleStatusUpdate(event);
  }

  @EventPattern(KafkaTopics.SOIL_STATUS_UPDATED)
  async handleSoilStatusUpdate(@Payload() event: jobStatusUpdatedEvent.JobStatusUpdatedEvent) {
    this.logger.log(`SOIL result received. jobId=${event.jobId}`);
    await this.jobsService.handleStatusUpdate(event);
  }
}