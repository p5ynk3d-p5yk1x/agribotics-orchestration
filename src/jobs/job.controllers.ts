import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { uploadConfig } from '../common/upload.config';
import { CreateJobDto } from './dtos/create-job.dto';
import { CreateSoilJobDto } from './dtos/create-soil-job.dto';
import { JobType } from './enums/job-type.enum';
import { JobsService } from './services/jobs.service';

@Controller('/api/jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file',uploadConfig))
  createJob(@CurrentUser() user: JwtUser,@Body() dto: CreateJobDto,@UploadedFile() file: Express.Multer.File) {
    return this.jobsService.createJob(user.userId,dto.jobType,file);
  }

  @Post('soil')
  createSoilJob(@CurrentUser() user: JwtUser,@Body() dto: CreateSoilJobDto) {
    return this.jobsService.createSoilJob(user.userId,dto);
  }

  @Get(':jobId')
  getJob(@CurrentUser() user: JwtUser,@Param('jobId') jobId: string) {
    return this.jobsService.getJob(user.userId,jobId);
  }

  @Get('/type/:jobType')
  getJobsByType(@CurrentUser() user: JwtUser,@Param('jobType') jobType: JobType) {
    return this.jobsService.getJobsByType(user.userId,jobType);
  }
}