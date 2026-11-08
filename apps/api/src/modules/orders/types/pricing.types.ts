import type { BusinessHour } from '../../../common/utils/time.js';

export type QuotePickupTimeType = 'ASAP' | 'SCHEDULED';

export type QuoteProductStatus = 'ON_SALE' | 'SOLD_OUT' | 'OFF_SHELF';

export interface PricingSpecOption {
  id: string;
  name: string;
  priceDeltaCents: number;
  isAvailable: boolean;
}

export interface PricingSpecGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  options: PricingSpecOption[];
}

export interface PricingProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  basePriceCents: number;
  status: QuoteProductStatus;
  specGroups: PricingSpecGroup[];
}

export interface QuoteLineInput {
  productId: string;
  quantity: number;
  optionIds: string[];
}

export interface PricingStore {
  businessHours: BusinessHour[];
  isAcceptingOrders: boolean;
  prepMinutes: number;
  perOrderMinutes: number;
}

export interface QuotePricingInput {
  items: QuoteLineInput[];
  products: PricingProduct[];
  store: PricingStore;
  pickupTimeType: QuotePickupTimeType;
  scheduledAt: Date | null;
  now: Date;
  queueCount: number;
}

export interface QuoteOptionSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface QuoteLine {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  options: QuoteOptionSnapshot[];
  specText: string;
}

export interface QuoteResult {
  items: QuoteLine[];
  itemsAmountCents: number;
  discountCents: number;
  payableCents: number;
  pickupTimeType: QuotePickupTimeType;
  scheduledAt: Date | null;
  estimatedReadyAt: Date;
}
