import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: true });
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ToCoffee API')
      .setDescription('单店自提咖啡点单 P0 API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  if (process.env.NODE_ENV !== 'production') {
    Logger.log(
      `Swagger UI: http://localhost:${port}/api/docs`,
      'Bootstrap',
    );
  }
}

await bootstrap();
