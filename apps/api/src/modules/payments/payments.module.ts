import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { PaymentsService } from './services/payments.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProviderPort,
} from './types/payment.types.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentProviderPort => {
        const mode = config.get<string>('paymentMode') ?? 'mock';
        if (mode !== 'mock') {
          throw new Error(
            `PAYMENT_MODE=${mode} 尚未实现；P0 只支持 mock 支付`,
          );
        }
        return new MockPaymentProvider();
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
