import { ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useShopStore } from '@/stores/store'
import type { Product, SelectedOption } from '@/types/catalog'
import type { Order, OrderItem } from '@/types/order'

function snapshotOptions(item: OrderItem): SelectedOption[] {
  return (item.specSnapshot ?? []).map((option) => ({
    groupId: option.groupId,
    groupName: option.groupName,
    optionId: option.optionId,
    optionName: option.optionName,
    priceDeltaCents: option.priceDeltaCents,
  }))
}

function snapshotProduct(item: OrderItem, options: SelectedOption[]): Product {
  const optionAmount = options.reduce((sum, option) => sum + option.priceDeltaCents, 0)
  return {
    id: item.productId,
    name: item.productName,
    description: '',
    imageUrl: item.productImage || '/static/placeholder-product.png',
    basePriceCents: Math.max(0, item.unitPriceCents - optionAmount),
    tags: [],
    status: 'ON_SALE',
    specGroups: [],
  }
}

export function useReorder() {
  const shop = useShopStore()
  const cart = useCartStore()
  const reordering = ref(false)

  async function reorder(order: Order): Promise<boolean> {
    if (reordering.value) return false
    reordering.value = true
    try {
      await shop.load()
      if (!shop.store) {
        uni.showToast({ title: '门店信息加载失败', icon: 'none' })
        return false
      }

      cart.hydrate(shop.store.id)
      for (const item of order.items) {
        const options = snapshotOptions(item)
        cart.addItem({
          product: snapshotProduct(item, options),
          selectedOptions: options,
          quantity: item.quantity,
        })
      }

      uni.showToast({ title: '已加入购物车', icon: 'success' })
      return true
    } finally {
      reordering.value = false
    }
  }

  return { reordering, reorder }
}
