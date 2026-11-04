import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  configureApp(app);

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  if (process.env.NODE_ENV !== 'production') {
    Logger.log(`Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

await bootstrap();
