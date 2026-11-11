import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminStoresController } from './controllers/admin-stores.controller.js';
import { StoresController } from './controllers/stores.controller.js';
import { AdminStoresService } from './services/admin-stores.service.js';
import { StoresService } from './services/stores.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StoresController, AdminStoresController],
  providers: [StoresService, AdminStoresService],
  exports: [StoresService, AdminStoresService],
})
export class StoresModule {}
