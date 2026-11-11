import type { Store } from '@prisma/client';
import { toStorePublic } from './store.mapper.js';
import type { AdminStorePublic } from '../types/admin-store.types.js';

export function toAdminStore(store: Store, now = new Date()): AdminStorePublic {
  return {
    ...toStorePublic(store, now),
    pickupCodePrefix: store.pickupCodePrefix,
  };
}
