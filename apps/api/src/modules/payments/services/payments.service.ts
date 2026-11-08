import { Inject, Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

  /**
   * P0 的 mock 退款立即成功：写 refund、把原支付标记为 REFUNDED。
   * 真实微信退款接入后，这里应先返回 PENDING，再由回调推进。
   */
  async refund(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
    now: Date,
  ) {
    const payment = await tx.payment.findFirst({
      where: { orderId, status: PaymentStatus.SUCCESS },
      orderBy: { paidAt: 'desc' },
    });

    if (!payment) {
      throw new AppError(
        ERROR_CODES.ORDER_INVALID_STATUS,
        '订单没有可退款的支付记录',
        409,
      );
    }

    const refund = await tx.refund.create({
      data: {
        orderId,
        paymentId: payment.id,
        amountCents: payment.amountCents,
        reason,
        status: RefundStatus.SUCCESS,
        providerRefundId: `MOCKREFUND-${randomUUID()}`,
        completedAt: now,
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });

    return refund;
  }
}
