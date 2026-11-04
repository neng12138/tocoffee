import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { CatalogService } from './services/catalog.service.js';

@Module({
  imports: [StoresModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
