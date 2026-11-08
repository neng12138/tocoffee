import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import {
  getBusinessHoursState,
  getZonedNow,
} from '../../../common/utils/time.js';
import type {
  PricingSpecGroup,
  PricingSpecOption,
  QuoteLine,
  QuoteLineInput,
  QuoteOptionSnapshot,
  QuotePricingInput,
  QuoteResult,
} from '../types/pricing.types.js';

const MAX_ITEMS = 20;
const MAX_QUANTITY = 20;
const MAX_OPTIONS_PER_ITEM = 10;
const MAX_READY_MINUTES = 30;
const MIN_LEAD_MINUTES = 15;
const MAX_AHEAD_MINUTES = 120;
const SCHEDULE_GRANULARITY_MINUTES = 15;

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function fail(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  status: number,
  details?: unknown,
): never {
  throw new AppError(code, message, status, details);
}

@Injectable()
export class PricingService {
  quote(input: QuotePricingInput): QuoteResult {
    this.validateInput(input);

    const productById = new Map(
      input.products.map((product) => [product.id, product]),
    );
    const lines = input.items.map((item) =>
      this.priceLine(item, productById.get(item.productId)),
    );
    const itemsAmountCents = lines.reduce(
      (sum, line) => sum + line.totalCents,
      0,
    );

    return {
      items: lines,
      itemsAmountCents,
      discountCents: 0,
      payableCents: itemsAmountCents,
      pickupTimeType: input.pickupTimeType,
      scheduledAt:
        input.pickupTimeType === 'SCHEDULED' ? input.scheduledAt : null,
      estimatedReadyAt: this.estimatedReadyAt(input),
    };
  }

  private validateInput(input: QuotePricingInput): void {
    if (input.items.length === 0 || input.items.length > MAX_ITEMS) {
      fail(
        ERROR_CODES.VALIDATION_ERROR,
        `一次最多结算 ${MAX_ITEMS} 行商品`,
        400,
      );
    }

    if (!Number.isFinite(input.now.getTime())) {
      fail(ERROR_CODES.VALIDATION_ERROR, '当前时间无效', 400);
    }

    if (
      input.pickupTimeType !== 'ASAP' &&
      input.pickupTimeType !== 'SCHEDULED'
    ) {
      fail(ERROR_CODES.VALIDATION_ERROR, '取餐时间类型无效', 400);
    }

    const seenLines = new Set<string>();

    input.items.forEach((item, index) => {
      if (!item.productId) {
        fail(ERROR_CODES.VALIDATION_ERROR, '商品不能为空', 400, { index });
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY
      ) {
        fail(
          ERROR_CODES.VALIDATION_ERROR,
          `商品数量必须在 1–${MAX_QUANTITY} 之间`,
          400,
          { index },
        );
      }

      if (
        !Array.isArray(item.optionIds) ||
        item.optionIds.length > MAX_OPTIONS_PER_ITEM
      ) {
        fail(
          ERROR_CODES.VALIDATION_ERROR,
          `每行最多选择 ${MAX_OPTIONS_PER_ITEM} 个规格`,
          400,
          { index },
        );
      }

      if (new Set(item.optionIds).size !== item.optionIds.length) {
        fail(ERROR_CODES.VALIDATION_ERROR, '规格选项不能重复', 400, {
          index,
        });
      }

      const lineKey = `${item.productId}:${[...item.optionIds].sort().join(',')}`;
      if (seenLines.has(lineKey)) {
        fail(ERROR_CODES.VALIDATION_ERROR, '购物车存在重复商品行', 400, {
          index,
        });
      }
      seenLines.add(lineKey);
    });

    if (input.pickupTimeType === 'SCHEDULED') {
      this.validateScheduledAt(input);
    } else {
      this.validateImmediatePickup(input);
    }
  }

  private validateImmediatePickup(input: QuotePricingInput): void {
    if (!input.store.isAcceptingOrders) {
      fail(ERROR_CODES.STORE_CLOSED, '门店当前暂停接单', 409);
    }

    const hoursState = getBusinessHoursState(
      input.store.businessHours,
      input.now,
    );
    if (!hoursState.isWithinHours) {
      fail(ERROR_CODES.STORE_CLOSED, '门店当前不在营业时间', 409);
    }
  }

  private validateScheduledAt(input: QuotePricingInput): void {
    if (!input.store.isAcceptingOrders) {
      fail(ERROR_CODES.STORE_CLOSED, '门店当前暂停接单', 409);
    }

    const scheduledAt = input.scheduledAt;
    if (!scheduledAt || !Number.isFinite(scheduledAt.getTime())) {
      fail(ERROR_CODES.VALIDATION_ERROR, '预约取餐时间无效', 400);
    }

    if (
      scheduledAt.getUTCSeconds() !== 0 ||
      scheduledAt.getUTCMilliseconds() !== 0
    ) {
      fail(
        ERROR_CODES.VALIDATION_ERROR,
        '预约取餐时间必须精确到 15 分钟',
        400,
      );
    }

    if (
      getZonedNow(scheduledAt).minutes % SCHEDULE_GRANULARITY_MINUTES !==
      0
    ) {
      fail(
        ERROR_CODES.VALIDATION_ERROR,
        '预约取餐时间必须是 15 分钟的整数倍',
        400,
      );
    }

    const earliest = input.now.getTime() + MIN_LEAD_MINUTES * 60_000;
    const latest = input.now.getTime() + MAX_AHEAD_MINUTES * 60_000;
    if (scheduledAt.getTime() < earliest) {
      fail(
        ERROR_CODES.VALIDATION_ERROR,
        `预约取餐时间至少为当前时间 ${MIN_LEAD_MINUTES} 分钟后`,
        400,
      );
    }
    if (scheduledAt.getTime() > latest) {
      fail(
        ERROR_CODES.VALIDATION_ERROR,
        `预约取餐时间最晚为当前时间 ${MAX_AHEAD_MINUTES} 分钟后`,
        400,
      );
    }

    const hoursState = getBusinessHoursState(
      input.store.businessHours,
      scheduledAt,
    );
    if (!hoursState.isWithinHours) {
      fail(ERROR_CODES.STORE_CLOSED, '预约时间不在营业时间内', 409);
    }
  }

  private priceLine(
    item: QuoteLineInput,
    product: QuotePricingInput['products'][number] | undefined,
  ): QuoteLine {
    if (!product || product.status !== 'ON_SALE') {
      fail(
        ERROR_CODES.PRODUCT_UNAVAILABLE,
        '商品已售罄或已下架',
        409,
        { productId: item.productId },
      );
    }

    const optionById = new Map<
      string,
      { group: PricingSpecGroup; option: PricingSpecOption }
    >();
    for (const group of product.specGroups) {
      for (const option of group.options) {
        optionById.set(option.id, { group, option });
      }
    }

    const selectedByGroup = new Map<string, PricingSpecOption[]>();
    const selectedOptions: QuoteOptionSnapshot[] = [];

    for (const optionId of item.optionIds) {
      const match = optionById.get(optionId);
      if (!match) {
        fail(ERROR_CODES.SPEC_REQUIRED, '规格选项不属于该商品', 400, {
          productId: product.id,
          optionId,
        });
      }
      if (!match.option.isAvailable) {
        fail(ERROR_CODES.PRODUCT_UNAVAILABLE, '所选规格已售罄', 409, {
          productId: product.id,
          optionId,
        });
      }

      const selected = selectedByGroup.get(match.group.id) ?? [];
      selected.push(match.option);
      selectedByGroup.set(match.group.id, selected);
    }

    for (const group of product.specGroups) {
      const selected = selectedByGroup.get(group.id) ?? [];
      const minSelect = group.required
        ? Math.max(1, group.minSelect)
        : Math.max(0, group.minSelect);
      const maxSelect = Math.max(minSelect, group.maxSelect);

      if (selected.length < minSelect) {
        fail(ERROR_CODES.SPEC_REQUIRED, `请选择${group.name}`, 400, {
          productId: product.id,
          groupId: group.id,
          minSelect,
          maxSelect,
        });
      }
      if (
        selected.length > maxSelect ||
        (!group.multiSelect && selected.length > 1)
      ) {
        fail(
          ERROR_CODES.SPEC_REQUIRED,
          `${group.name}最多选择 ${maxSelect} 项`,
          400,
          { productId: product.id, groupId: group.id, maxSelect },
        );
      }

      for (const option of selected) {
        selectedOptions.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDeltaCents: option.priceDeltaCents,
        });
      }
    }

    const unitPriceCents =
      product.basePriceCents +
      selectedOptions.reduce(
        (sum, option) => sum + option.priceDeltaCents,
        0,
      );
    const totalCents = unitPriceCents * item.quantity;

    return {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      quantity: item.quantity,
      unitPriceCents,
      totalCents,
      options: selectedOptions,
      specText: selectedOptions.map((option) => option.optionName).join(' / '),
    };
  }

  private estimatedReadyAt(input: QuotePricingInput): Date {
    if (input.pickupTimeType === 'SCHEDULED') {
      return input.scheduledAt as Date;
    }

    const prepMinutes = isNonNegativeInteger(input.store.prepMinutes)
      ? input.store.prepMinutes
      : 0;
    const perOrderMinutes = isNonNegativeInteger(input.store.perOrderMinutes)
      ? input.store.perOrderMinutes
      : 0;
    const queueCount = isNonNegativeInteger(input.queueCount)
      ? input.queueCount
      : 0;
    const minutes = Math.min(
      MAX_READY_MINUTES,
      prepMinutes + queueCount * perOrderMinutes,
    );

    return new Date(input.now.getTime() + minutes * 60_000);
  }
}
