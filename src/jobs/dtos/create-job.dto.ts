import { IsIn } from 'class-validator';
import { JobType } from '../enums/job-type.enum';

export class CreateJobDto {
  @IsIn([JobType.WEED,JobType.DISEASE])
  jobType!: JobType.WEED | JobType.DISEASE;
}