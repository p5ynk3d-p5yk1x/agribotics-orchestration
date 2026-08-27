import { JobType } from '../../enums/job-type.enum';

export interface JobCreatedEvent {
  jobId: string;
  userId: string;
  jobType: JobType;
  imagePath: string;
  createdAt: string;
}