import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'agribotics-orchestrator',
            brokers: ['localhost:9092']
          },
          consumer: {
            groupId: 'weed-inference-group'
          }
        }
      }
    ])
  ],
  exports: [ClientsModule]
})
export class KafkaModule {}