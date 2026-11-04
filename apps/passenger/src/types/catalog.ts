export type ProductStatus = 'ON_SALE' | 'SOLD_OUT' | 'OFF_SHELF'

export interface BusinessHours {
  day: number
  open: string
  close: string
}

export interface StoreInfo {
  id: string
  name: string
  address: string
  phone: string
  latitude: number | null
  longitude: number | null
  businessHours: BusinessHours[]
  todayHours: BusinessHours | null
  isOpen: boolean
  isAcceptingOrders: boolean
  prepMinutes: number
  perOrderMinutes: number
  pickupNotice: string
}

export interface SpecOption {
  id: string
  name: string
  priceDeltaCents: number
  isDefault: boolean
}

export interface SpecGroup {
  id: string
  name: string
  required: boolean
  multiSelect: boolean
  minSelect: number
  maxSelect: number
  options: SpecOption[]
}

export interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  basePriceCents: number
  tags: string[]
  status: ProductStatus
  specGroups: SpecGroup[]
}

export interface MenuCategory {
  id: string
  name: string
  products: Product[]
}

export interface MenuResponse {
  categories: MenuCategory[]
}

export interface SelectedOption {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  priceDeltaCents: number
}
