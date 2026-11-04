import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { AdminCategoriesController } from './controllers/admin-categories.controller.js';
import { AdminProductsController } from './controllers/admin-products.controller.js';
import {
  AdminSpecGroupsController,
  AdminSpecOptionsController,
} from './controllers/admin-specs.controller.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { AdminCatalogService } from './services/admin-catalog.service.js';
import { CatalogService } from './services/catalog.service.js';

@Module({
  imports: [StoresModule, AuthModule],
  controllers: [
    CatalogController,
    AdminCategoriesController,
    AdminProductsController,
    AdminSpecGroupsController,
    AdminSpecOptionsController,
  ],
  providers: [CatalogService, AdminCatalogService],
})
export class CatalogModule {}
