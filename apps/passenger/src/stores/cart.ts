import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Product, SelectedOption } from '@/types/catalog'

const CART_STORAGE_KEY = 'tocoffee.cart.v1'
const MAX_QUANTITY = 20

export interface CartItem {
  key: string
  productId: string
  productName: string
  imageUrl: string
  basePriceCents: number
  optionIds: string[]
  optionNames: string[]
  unitPriceCents: number
  quantity: number
}

export interface AddCartInput {
  product: Product
  selectedOptions: SelectedOption[]
  quantity: number
}

interface StoredCart {
  storeId: string
  items: CartItem[]
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return (
    typeof item.key === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    typeof item.unitPriceCents === 'number' &&
    Array.isArray(item.optionIds) &&
    Array.isArray(item.optionNames) &&
    typeof item.quantity === 'number' &&
    item.quantity > 0
  )
}

export const useCartStore = defineStore('cart', () => {
  const storeId = ref('')
  const items = ref<CartItem[]>([])
  const hydrated = ref(false)

  const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const totalCents = computed(() => items.value.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  function persist(): void {
    const data: StoredCart = { storeId: storeId.value, items: items.value }
    uni.setStorageSync(CART_STORAGE_KEY, data)
  }

  function hydrate(currentStoreId: string): void {
    if (hydrated.value && storeId.value === currentStoreId) return

    storeId.value = currentStoreId
    hydrated.value = true
    items.value = []

    try {
      const raw = uni.getStorageSync(CART_STORAGE_KEY) as StoredCart | ''
      if (raw && typeof raw === 'object' && raw.storeId === currentStoreId && Array.isArray(raw.items)) {
        items.value = raw.items.filter(isCartItem)
      }
    } catch {
      items.value = []
    }
  }

  function makeKey(productId: string, optionIds: string[]): string {
    return `${productId}:${[...optionIds].sort().join(',')}`
  }

  function addItem(input: AddCartInput): CartItem {
    const quantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(input.quantity)))
    const optionIds = input.selectedOptions.map((option) => option.optionId)
    const key = makeKey(input.product.id, optionIds)
    const existing = items.value.find((item) => item.key === key)

    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity)
      persist()
      return existing
    }

    const item: CartItem = {
      key,
      productId: input.product.id,
      productName: input.product.name,
      imageUrl: input.product.imageUrl,
      basePriceCents: input.product.basePriceCents,
      optionIds,
      optionNames: input.selectedOptions.map((option) => option.optionName),
      unitPriceCents:
        input.product.basePriceCents +
        input.selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0),
      quantity,
    }

    items.value.push(item)
    persist()
    return item
  }

  function setQuantity(key: string, quantity: number): void {
    const item = items.value.find((entry) => entry.key === key)
    if (!item) return

    if (quantity <= 0) {
      removeItem(key)
      return
    }

    item.quantity = Math.min(MAX_QUANTITY, Math.floor(quantity))
    persist()
  }

  function changeQuantity(key: string, delta: number): void {
    const item = items.value.find((entry) => entry.key === key)
    if (!item) return
    setQuantity(key, item.quantity + delta)
  }

  function removeItem(key: string): void {
    items.value = items.value.filter((item) => item.key !== key)
    persist()
  }

  function clear(): void {
    items.value = []
    persist()
  }

  return {
    storeId,
    items,
    totalQuantity,
    totalCents,
    isEmpty,
    hydrate,
    addItem,
    setQuantity,
    changeQuantity,
    removeItem,
    clear,
  }
})
