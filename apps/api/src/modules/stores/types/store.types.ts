import type { BusinessHour } from '../../../common/utils/time.js';

export interface StorePublic {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  businessHours: BusinessHour[];
  todayHours: BusinessHour | null;
  isOpen: boolean;
  isAcceptingOrders: boolean;
  prepMinutes: number;
  perOrderMinutes: number;
  pickupNotice: string | null;
}
