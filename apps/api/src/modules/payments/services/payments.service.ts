import { Inject, Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProviderPort,
} from '../types/payment.types.js';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProviderPort,
  ) {}

  async charge(
    tx: Prisma.TransactionClient,
    orderId: string,
    amountCents: number,
    now: Date,
  ) {
    let result;
    try {
      result = await this.provider.charge({ orderId, amountCents, now });
    } catch {
      throw new AppError(
        ERROR_CODES.PAYMENT_FAILED,
        '支付失败，请稍后重试',
        502,
      );
    }

    return tx.payment.create({
      data: {
        orderId,
        provider: result.provider,
        transactionId: result.transactionId,
        amountCents,
        status: PaymentStatus.SUCCESS,
        rawPayload: result.rawPayload,
        paidAt: result.paidAt,
      },
    });
  }
}
