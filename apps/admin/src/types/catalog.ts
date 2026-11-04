export type CategoryStatus = 'ACTIVE' | 'DISABLED'
export type ProductStatus = 'ON_SALE' | 'SOLD_OUT' | 'OFF_SHELF'
export type StaffRole = 'OWNER' | 'STAFF'

export interface StaffProfile {
  id: string
  username: string
  name: string
  role: StaffRole
  store: {
    id: string
    name: string
  }
}

export interface AdminCategory {
  id: string
  name: string
  sort: number
  status: CategoryStatus
  productCount: number
}

export interface AdminSpecOption {
  id: string
  groupId: string
  name: string
  priceDeltaCents: number
  isDefault: boolean
  isAvailable: boolean
  sort: number
}

export interface AdminSpecGroup {
  id: string
  name: string
  required: boolean
  multiSelect: boolean
  minSelect: number
  maxSelect: number
  sort: number
  productCount: number
  options: AdminSpecOption[]
}

export interface AdminProductSpecGroup {
  id: string
  name: string
}

export interface AdminProduct {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  basePriceCents: number
  tags: string[]
  status: ProductStatus
  sort: number
  category: {
    id: string
    name: string
  }
  specGroups: AdminProductSpecGroup[]
  updatedAt: string
}

export interface AdminProductDetail extends AdminProduct {
  categoryId: string
  specGroupIds: string[]
}

export interface CategoryInput {
  name: string
  sort?: number
  status?: CategoryStatus
}

export interface SpecGroupInput {
  name: string
  required: boolean
  multiSelect: boolean
  minSelect: number
  maxSelect: number
  sort?: number
}

export interface SpecOptionInput {
  name: string
  priceDeltaCents: number
  isDefault?: boolean
  isAvailable?: boolean
  sort?: number
}

export interface ProductInput {
  name: string
  categoryId: string
  basePriceCents: number
  description?: string | null
  imageUrl?: string | null
  tags?: string[]
  status?: ProductStatus
  sort?: number
  specGroupIds?: string[]
}
