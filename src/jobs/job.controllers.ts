import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';

import { uploadConfig } from './upload.config';
import { CreateJobDto } from './dtos/create-job.dto';
import { JobsService } from './services/jobs.service';
import { JobType } from './enums/job-type.enum';

@Controller('/api/jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {

  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', uploadConfig))
  async createJob(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateJobDto,
    @UploadedFile()
    file: Express.Multer.File
  ) {
    console.log(file);
    return this.jobsService.createJob(
      user.userId,
      dto.jobType,
      file.path
    );
  }

  @Get(':jobId')
  async getJob(
    @CurrentUser() user: JwtUser,
    @Param('jobId') jobId: string
  ) {
    return this.jobsService.getJob(user.userId, jobId);
  }

  @Get('/type/:jobType')
  async getJobsByType(
    @CurrentUser() user: JwtUser,
    @Param('jobType') jobType: JobType,
  ) {
    return this.jobsService.getJobsByType(user.userId, jobType);
  }
}