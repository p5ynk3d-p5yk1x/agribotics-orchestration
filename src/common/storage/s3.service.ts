import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly jobsPrefix: string;
  private readonly productsPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow<string>('aws.region');
    this.bucket = this.configService.getOrThrow<string>('aws.s3.bucket');
    this.jobsPrefix = this.configService.get<string>('aws.s3.jobsPrefix') ?? 'jobs';
    this.productsPrefix = this.configService.get<string>('aws.s3.productsPrefix') ?? 'products';

    this.client = new S3Client({
      region,
    });
  }

  async upload(file: Express.Multer.File, key: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return key;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async createSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn,
    });
  }

  getJobKey(jobType: string, jobId: string): string {
    return `${this.jobsPrefix}/${jobType}/${jobId}`;
  }

  getProductKey(productId: string): string {
    return `${this.productsPrefix}/${productId}`;
  }

  getS3Uri(key: string): string {
    return `s3://${this.bucket}/${key}`;
  }
}