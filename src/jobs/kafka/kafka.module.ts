import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'agribotics-orchestrator',
              brokers: [
                configService.get<string>('kafka.broker')!,
              ],
            },
            consumer: {
              groupId: 'weed-inference-group',
            },
          },
        }),
      },
    ]),
  ],

  exports: [ClientsModule],
})
export class KafkaModule {}
