import type { StorePublic } from './store.types.js';

export interface AdminStorePublic extends StorePublic {
  pickupCodePrefix: string;
}
