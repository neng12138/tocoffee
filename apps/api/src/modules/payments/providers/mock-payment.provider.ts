import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentProviderPort,
} from '../types/payment.types.js';

@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    return {
      provider: PaymentProvider.MOCK,
      transactionId: `MOCK-${randomUUID()}`,
      amountCents: input.amountCents,
      paidAt: input.now,
      rawPayload: {
        mode: 'mock',
        orderId: input.orderId,
      },
    };
  }
}
