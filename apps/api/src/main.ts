import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  configureApp(app);

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  if (process.env.NODE_ENV !== 'production') {
    Logger.log(`Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

await bootstrap();
