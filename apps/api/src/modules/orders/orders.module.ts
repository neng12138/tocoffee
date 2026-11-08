import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersService } from './services/orders.service.js';
import { PricingService } from './services/pricing.service.js';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService, PricingService],
})
export class OrdersModule {}
