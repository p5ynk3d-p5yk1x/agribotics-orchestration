import { JobType } from '../../enums/job-type.enum';

export interface JobCreatedEvent {
  jobId: string;
  userId: string;
  jobType: JobType.WEED | JobType.DISEASE;
  imagePath: string;
  createdAt: string;
}