import type { Store } from '@prisma/client';
import {
  getBusinessHoursState,
  parseBusinessHours,
} from '../../../common/utils/time.js';
import type { StorePublic } from '../types/store.types.js';

export function toStorePublic(store: Store, now = new Date()): StorePublic {
  const businessHours = parseBusinessHours(store.businessHours);
  const state = getBusinessHoursState(businessHours, now);

  return {
    id: store.id,
    name: store.name,
    address: store.address,
    phone: store.phone,
    latitude: store.latitude,
    longitude: store.longitude,
    businessHours,
    todayHours: state.todayHours,
    isOpen: store.isAcceptingOrders && state.isWithinHours,
    isAcceptingOrders: store.isAcceptingOrders,
    prepMinutes: store.prepMinutes,
    perOrderMinutes: store.perOrderMinutes,
    pickupNotice: store.pickupNotice,
  };
}
