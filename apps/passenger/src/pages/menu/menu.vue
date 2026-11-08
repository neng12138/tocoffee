<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import CartSheet from '@/components/CartSheet.vue'
import ProductCard from '@/components/ProductCard.vue'
import SpecSheet from '@/components/SpecSheet.vue'
import { useCartStore } from '@/stores/cart'
import { useShopStore } from '@/stores/store'
import type { Product, SelectedOption } from '@/types/catalog'
import { formatPrice } from '@/utils/money'

interface SectionOffset {
  id: string
  top: number
}

interface ProductScrollEvent {
  detail: {
    scrollTop: number
  }
}

const shop = useShopStore()
const cart = useCartStore()

const activeCategoryId = ref('')
const productScrollTarget = ref('')
const currentScrollTop = ref(0)
const sectionOffsets = ref<SectionOffset[]>([])
const specVisible = ref(false)
const activeProduct = ref<Product | null>(null)
const cartVisible = ref(false)
const cartPulse = ref(false)
const pendingProductId = ref('')
let measureTimer: ReturnType<typeof setTimeout> | null = null

const isStoreOpen = computed(() => shop.store?.isOpen ?? false)
const hoursLabel = computed(() => {
  const today = shop.store?.todayHours
  return today ? `${today.open} – ${today.close}` : '今日休息'
})

onLoad((query) => {
  const productId = query?.product
  if (typeof productId === 'string' && productId) pendingProductId.value = productId
})

onShow(() => {
  void initialize()
})

async function initialize(): Promise<void> {
  await shop.load()
  if (!shop.store) return

  cart.hydrate(shop.store.id)

  if (!activeCategoryId.value && shop.categories.length) {
    activeCategoryId.value = shop.categories[0].id
  }

  await nextTick()
  scheduleMeasure()

  if (pendingProductId.value) {
    const product = shop.findProduct(pendingProductId.value)
    pendingProductId.value = ''
    if (product) openSpec(product)
  }
}

function scheduleMeasure(): void {
  if (measureTimer) clearTimeout(measureTimer)
  measureTimer = setTimeout(measureSections, 120)
}

function measureSections(): void {
  if (!shop.categories.length) return

  const query = uni.createSelectorQuery()
  query.select('.product-scroll').boundingClientRect()
  for (const category of shop.categories) {
    query.select(`#${sectionId(category.id)}`).boundingClientRect()
  }

  query.exec((result) => {
    const rows = result as Array<{ top?: number } | null>
    const container = rows[0]
    if (!container || typeof container.top !== 'number') return
    const containerTop = container.top

    const offsets: SectionOffset[] = []
    shop.categories.forEach((category, index) => {
      const row = rows[index + 1]
      if (!row || typeof row.top !== 'number') return
      offsets.push({
        id: category.id,
        top: row.top - containerTop + currentScrollTop.value,
      })
    })
    sectionOffsets.value = offsets.sort((left, right) => left.top - right.top)
  })
}

function sectionId(categoryId: string): string {
  return `cat-${categoryId}`
}

function scrollToCategory(categoryId: string): void {
  activeCategoryId.value = categoryId
  productScrollTarget.value = ''
  nextTick(() => {
    productScrollTarget.value = sectionId(categoryId)
  })
}

function onProductScroll(event: ProductScrollEvent): void {
  const top = event.detail.scrollTop
  currentScrollTop.value = top

  if (!sectionOffsets.value.length) return

  let currentId = sectionOffsets.value[0].id
  for (const section of sectionOffsets.value) {
    if (top + 28 >= section.top) currentId = section.id
    else break
  }

  if (currentId !== activeCategoryId.value) activeCategoryId.value = currentId
}

function openSpec(product: Product): void {
  activeProduct.value = product
  specVisible.value = true
}

function closeSpec(): void {
  specVisible.value = false
}

function handleAdd(payload: { optionIds: string[]; quantity: number }): void {
  const product = activeProduct.value
  if (!product) return

  const selectedOptions: SelectedOption[] = []
  for (const group of product.specGroups) {
    for (const option of group.options) {
      if (payload.optionIds.includes(option.id)) {
        selectedOptions.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDeltaCents: option.priceDeltaCents,
        })
      }
    }
  }

  cart.addItem({ product, selectedOptions, quantity: payload.quantity })
  specVisible.value = false
  cartPulse.value = true
  setTimeout(() => {
    cartPulse.value = false
  }, 600)
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}

function handleCartChange(payload: { key: string; quantity: number }): void {
  cart.setQuantity(payload.key, payload.quantity)
}

function handleCheckout(): void {
  cartVisible.value = false
  uni.navigateTo({ url: '/pages/checkout/checkout' })
}

function retry(): void {
  shop.load(true)
}
</script>

<template>
  <view class="menu-page">
    <view class="store-strip">
      <view class="strip-main">
        <view class="strip-name-row">
          <text class="strip-name">{{ shop.store?.name || 'ToCoffee' }}</text>
          <text class="strip-status" :class="{ 'is-closed': !isStoreOpen }">
            {{ isStoreOpen ? '营业中' : '休息中' }}
          </text>
        </view>
        <text class="strip-meta">{{ hoursLabel }} · 到店自提</text>
      </view>
      <view class="strip-time">
        <text class="strip-time-value">{{ shop.store?.prepMinutes ?? 8 }}</text>
        <text class="strip-time-unit">分钟出杯</text>
      </view>
    </view>

    <view v-if="shop.loading && !shop.store" class="menu-state">
      <view class="loading-bean">☕</view>
      <text class="state-title">正在准备菜单</text>
      <text class="state-desc">咖啡师正在整理今天的豆子…</text>
    </view>

    <view v-else-if="shop.error && !shop.store" class="menu-state">
      <text class="state-title">菜单没有加载出来</text>
      <text class="state-desc">{{ shop.error }}</text>
      <view class="retry-btn" @click="retry">重新加载</view>
    </view>

    <view v-else-if="!shop.categories.length" class="menu-state">
      <text class="state-title">今天还没有上架商品</text>
      <text class="state-desc">请稍后再来看看</text>
    </view>

    <template v-else>
      <view class="menu-main">
        <scroll-view class="category-scroll" scroll-y>
          <view
            v-for="category in shop.categories"
            :key="category.id"
            class="category-item"
            :class="{ 'is-active': activeCategoryId === category.id }"
            @click="scrollToCategory(category.id)"
          >
            <view v-if="activeCategoryId === category.id" class="category-indicator"></view>
            <text class="category-name">{{ category.name }}</text>
            <text class="category-count">{{ category.products.length }}</text>
          </view>
        </scroll-view>

        <scroll-view
          class="product-scroll"
          scroll-y
          :scroll-into-view="productScrollTarget"
          :scroll-with-animation="true"
          @scroll="onProductScroll"
        >
          <view v-for="category in shop.categories" :id="sectionId(category.id)" :key="category.id" class="category-section">
            <view class="section-head">
              <text class="section-title">{{ category.name }}</text>
              <text class="section-count">{{ category.products.length }} 款</text>
            </view>
            <ProductCard
              v-for="product in category.products"
              :key="product.id"
              :product="product"
              @select="openSpec"
            />
          </view>

          <view class="menu-end">
            <view class="menu-end-line"></view>
            <text>今日菜单已全部呈现</text>
            <view class="menu-end-line"></view>
          </view>
        </scroll-view>
      </view>

      <view
        v-if="cart.totalQuantity > 0"
        class="cart-bar"
        :class="{ 'is-pulsing': cartPulse }"
        @click="cartVisible = true"
      >
        <view class="cart-bar-left">
          <view class="cart-icon">
            <text class="cart-icon-text">☕</text>
            <text class="cart-badge">{{ cart.totalQuantity > 99 ? '99+' : cart.totalQuantity }}</text>
          </view>
          <view class="cart-bar-copy">
            <text class="cart-bar-label">已选 {{ cart.totalQuantity }} 件</text>
            <text class="cart-bar-total">{{ formatPrice(cart.totalCents) }}</text>
          </view>
        </view>
        <view class="cart-bar-action">查看购物车 →</view>
      </view>
    </template>

    <SpecSheet :visible="specVisible" :product="activeProduct" @close="closeSpec" @add="handleAdd" />
    <CartSheet
      :visible="cartVisible"
      :items="cart.items"
      :total-cents="cart.totalCents"
      :total-quantity="cart.totalQuantity"
      @close="cartVisible = false"
      @change="handleCartChange"
      @remove="cart.removeItem"
      @clear="cart.clear"
      @checkout="handleCheckout"
    />
  </view>
</template>

<style scoped>
.menu-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px));
  overflow: hidden;
  background: #f5f1ea;
}

.store-strip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx;
  background: #fffdf9;
  border-bottom: 1rpx solid #eee4d8;
}

.strip-main {
  min-width: 0;
}

.strip-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.strip-name {
  overflow: hidden;
  color: #2b2118;
  font-size: 29rpx;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.strip-status {
  flex-shrink: 0;
  padding: 3rpx 12rpx;
  color: #4f7a5a;
  font-size: 18rpx;
  background: #eaf3ea;
  border-radius: 999rpx;
}

.strip-status.is-closed {
  color: #a26b52;
  background: #f7ebe4;
}

.strip-meta {
  display: block;
  margin-top: 6rpx;
  color: #9b8b7d;
  font-size: 21rpx;
}

.strip-time {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  padding-left: 20rpx;
}

.strip-time-value {
  color: #6f4e37;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1;
}

.strip-time-unit {
  margin-top: 4rpx;
  color: #a09487;
  font-size: 18rpx;
}

.menu-main {
  display: flex;
  flex: 1;
  min-height: 0;
  margin: 16rpx 20rpx 0;
  overflow: hidden;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 22rpx;
}

.category-scroll {
  flex-shrink: 0;
  width: 164rpx;
  height: 100%;
  background: #f7f2eb;
}

.category-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 92rpx;
  padding: 0 14rpx 0 22rpx;
  color: #8b7a6c;
}

.category-item.is-active {
  color: #2b2118;
  background: #fffdf9;
}

.category-indicator {
  position: absolute;
  top: 50%;
  left: 0;
  width: 6rpx;
  height: 34rpx;
  background: #6f4e37;
  border-radius: 0 6rpx 6rpx 0;
  transform: translateY(-50%);
}

.category-name {
  font-size: 24rpx;
  font-weight: 500;
  line-height: 1.3;
}

.category-count {
  color: #b9a18c;
  font-size: 18rpx;
}

.product-scroll {
  flex: 1;
  height: 100%;
  min-width: 0;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.category-section {
  padding-top: 18rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 6rpx 4rpx 16rpx;
}

.section-title {
  color: #2b2118;
  font-size: 30rpx;
  font-weight: 700;
}

.section-count {
  color: #b9a18c;
  font-size: 19rpx;
}

.menu-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx 0 36rpx;
  color: #b9a18c;
  font-size: 19rpx;
}

.menu-end-line {
  width: 32rpx;
  height: 1rpx;
  background: #e6dccf;
}

.cart-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  height: 104rpx;
  padding: 0 20rpx 0 18rpx;
  margin: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom));
  color: #fffdf9;
  background: #2b2118;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 28rpx rgba(43, 33, 24, 0.2);
}

.cart-bar.is-pulsing {
  animation: cart-pulse 0.6s ease;
}

@keyframes cart-pulse {
  0%,
  100% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.02);
  }
}

.cart-bar-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.cart-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  background: #f2d7b8;
  border-radius: 50%;
}

.cart-icon-text {
  font-size: 30rpx;
}

.cart-badge {
  position: absolute;
  top: -6rpx;
  right: -8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 6rpx;
  color: #2b2118;
  font-size: 18rpx;
  font-weight: 700;
  background: #f5c26b;
  border: 2rpx solid #2b2118;
  border-radius: 999rpx;
  box-sizing: border-box;
}

.cart-bar-copy {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.cart-bar-label {
  color: #c9bdb1;
  font-size: 19rpx;
}

.cart-bar-total {
  color: #fffdf9;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.2;
}

.cart-bar-action {
  flex-shrink: 0;
  padding: 16rpx 22rpx;
  color: #2b2118;
  font-size: 23rpx;
  font-weight: 600;
  background: #f2d7b8;
  border-radius: 999rpx;
}

.menu-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 48rpx;
  text-align: center;
}

.loading-bean {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  margin-bottom: 22rpx;
  font-size: 48rpx;
  background: #efe4d8;
  border-radius: 50%;
  animation: float-bean 1.6s ease-in-out infinite;
}

@keyframes float-bean {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8rpx);
  }
}

.state-title {
  color: #3d3026;
  font-size: 30rpx;
  font-weight: 600;
}

.state-desc {
  margin-top: 10rpx;
  color: #9b8b7d;
  font-size: 23rpx;
  line-height: 1.6;
}

.retry-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  padding: 0 30rpx;
  margin-top: 26rpx;
  color: #6f4e37;
  font-size: 24rpx;
  background: #efe4d8;
  border-radius: 999rpx;
}
</style>
