import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/job.module';
import { LandModule } from './land/land.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

import config from './config/config';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      validationSchema,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.url'),
      }),
    }),
    AuthModule,
    JobsModule,
    LandModule,
    MarketplaceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
