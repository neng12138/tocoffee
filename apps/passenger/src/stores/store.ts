import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMenu, fetchStore } from '@/api/catalog'
import type { MenuCategory, Product, StoreInfo } from '@/types/catalog'

export const useShopStore = defineStore('shop', () => {
  const store = ref<StoreInfo | null>(null)
  const categories = ref<MenuCategory[]>([])
  const loading = ref(false)
  const error = ref('')
  const loaded = ref(false)

  const products = computed<Product[]>(() => categories.value.flatMap((category) => category.products))

  const hotProducts = computed<Product[]>(() =>
    products.value
      .filter((product) => product.tags.some((tag) => tag === '招牌' || tag === '热销'))
      .slice(0, 6),
  )

  const soldOutCount = computed(() => products.value.filter((product) => product.status === 'SOLD_OUT').length)

  async function load(force = false): Promise<void> {
    if (loading.value) return
    if (loaded.value && !force) return

    loading.value = true
    error.value = ''
    try {
      const [storeData, menuData] = await Promise.all([fetchStore(), fetchMenu()])
      store.value = storeData
      categories.value = menuData.categories
      loaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '菜单加载失败，请稍后重试'
    } finally {
      loading.value = false
    }
  }

  function findProduct(productId: string): Product | undefined {
    return products.value.find((product) => product.id === productId)
  }

  return {
    store,
    categories,
    products,
    hotProducts,
    soldOutCount,
    loading,
    error,
    loaded,
    load,
    findProduct,
  }
})
