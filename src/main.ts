import { NestFactory } from '@nestjs/core';   // 🔥 REQUIRED
import { AppModule } from './app.module';  
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'], // change if needed
      },
      consumer: {
        groupId: 'inference-group',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}

bootstrap();