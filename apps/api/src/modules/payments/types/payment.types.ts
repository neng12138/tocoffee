import type { PaymentProvider, Prisma } from '@prisma/client';

export interface PaymentChargeInput {
  orderId: string;
  amountCents: number;
  now: Date;
}

export interface PaymentChargeResult {
  provider: PaymentProvider;
  transactionId: string;
  amountCents: number;
  paidAt: Date;
  rawPayload: Prisma.InputJsonValue;
}

export interface PaymentProviderPort {
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
