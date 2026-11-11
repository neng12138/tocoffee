export interface StoreBusinessHour {
  day: number
  open: string
  close: string
}

export interface AdminStore {
  id: string
  name: string
  address: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  businessHours: StoreBusinessHour[]
  todayHours: StoreBusinessHour | null
  isOpen: boolean
  isAcceptingOrders: boolean
  prepMinutes: number
  perOrderMinutes: number
  pickupNotice: string | null
  pickupCodePrefix: string
}

export interface UpdateStoreInput {
  name?: string
  address?: string
  phone?: string
  businessHours?: StoreBusinessHour[]
  isAcceptingOrders?: boolean
  prepMinutes?: number
  perOrderMinutes?: number
  pickupNotice?: string
  pickupCodePrefix?: string
}
