import { IsEnum } from 'class-validator';
import { JobType } from '../enums/job-type.enum';

export class CreateJobDto {

  @IsEnum(JobType)
  jobType!: JobType;
}