import { Module } from '@nestjs/common';
import { S3StorageService } from './s3.service';

@Module({
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}