import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersService } from './services/orders.service.js';
import { PickupCodeService } from './services/pickup-code.service.js';
import { PricingService } from './services/pricing.service.js';

@Module({
  imports: [AuthModule, StoresModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService, PickupCodeService],
  exports: [OrdersService, PricingService, PickupCodeService],
})
export class OrdersModule {}
