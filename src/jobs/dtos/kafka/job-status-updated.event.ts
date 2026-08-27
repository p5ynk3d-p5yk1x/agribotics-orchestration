import { JobStatus } from '../../enums/job-status.enum';
import { JobType } from '../../enums/job-type.enum';

export interface JobStatusUpdatedEvent {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  failureReason?: string;
  resultPayload?: unknown;
}