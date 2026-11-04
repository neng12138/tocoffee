<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import StoreCard from '@/components/StoreCard.vue'
import { useCartStore } from '@/stores/cart'
import { useShopStore } from '@/stores/store'
import type { Product } from '@/types/catalog'
import { formatPrice } from '@/utils/money'

const shop = useShopStore()
const cart = useCartStore()
const imageErrors = ref<Record<string, boolean>>({})

const hotList = computed(() => (shop.hotProducts.length ? shop.hotProducts : shop.products.slice(0, 4)))
const isClosed = computed(() => Boolean(shop.store) && !shop.store!.isOpen)

onShow(async () => {
  await shop.load()
  if (shop.store) cart.hydrate(shop.store.id)
})

function goMenu(productId?: string): void {
  const suffix = productId ? `?product=${encodeURIComponent(productId)}` : ''
  uni.navigateTo({ url: `/pages/menu/menu${suffix}` })
}

function onImageError(product: Product): void {
  imageErrors.value = { ...imageErrors.value, [product.id]: true }
}

function imageOf(product: Product): string {
  return imageErrors.value[product.id] ? '/static/placeholder-product.png' : product.imageUrl
}

function retry(): void {
  shop.load(true)
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="brand-row">
        <image class="brand-logo" src="/static/logo.png" mode="widthFix" />
        <view class="brand-pill">自提点单</view>
      </view>

      <text class="eyebrow">TOCOFFEE · DAILY BREW</text>
      <text class="title">今天，喝杯好咖啡</text>
      <text class="subtitle">现点现做，到店即取。把等待留给咖啡，把时间留给自己。</text>
    </view>

    <view v-if="shop.loading && !shop.store" class="state-card">
      <view class="skeleton-line skeleton-wide"></view>
      <view class="skeleton-line skeleton-mid"></view>
      <view class="skeleton-block"></view>
      <text class="state-text">正在准备今日菜单…</text>
    </view>

    <view v-else-if="shop.error && !shop.store" class="state-card">
      <text class="state-title">菜单暂时没有加载出来</text>
      <text class="state-desc">{{ shop.error }}</text>
      <view class="retry-btn" @click="retry">重新加载</view>
    </view>

    <template v-else>
      <StoreCard v-if="shop.store" :store="shop.store" />

      <view class="quick-row">
        <view class="quick-item">
          <text class="quick-icon">☕</text>
          <text class="quick-label">现点现做</text>
        </view>
        <view class="quick-item">
          <text class="quick-icon">⏱</text>
          <text class="quick-label">约 {{ shop.store?.prepMinutes ?? 8 }} 分钟</text>
        </view>
        <view class="quick-item">
          <text class="quick-icon">🛍</text>
          <text class="quick-label">到店自提</text>
        </view>
      </view>

      <view class="order-cta">
        <view class="cta-copy">
          <text class="cta-title">{{ isClosed ? '今日已打烊' : '想喝点什么？' }}</text>
          <text class="cta-desc">{{ isClosed ? '可以先看看菜单，营业后再来点单' : '菜单已准备好，选一杯喜欢的' }}</text>
        </view>
        <view class="cta-btn" @click="goMenu()">
          {{ isClosed ? '浏览菜单' : '开始点单' }}
          <text class="cta-arrow">→</text>
        </view>
      </view>

      <view v-if="hotList.length" class="section">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">TODAY'S PICK</text>
            <text class="section-title">今日推荐</text>
          </view>
          <text class="section-more" @click="goMenu()">全部菜单 →</text>
        </view>

        <scroll-view class="hot-scroll" scroll-x :show-scrollbar="false">
          <view class="hot-track">
            <view
              v-for="product in hotList"
              :key="product.id"
              class="hot-card"
              @click="goMenu(product.id)"
            >
              <view class="hot-media">
                <image
                  class="hot-image"
                  :src="imageOf(product)"
                  mode="aspectFill"
                  @error="onImageError(product)"
                />
                <view v-if="product.status === 'SOLD_OUT'" class="hot-sold-out">售罄</view>
                <view v-if="product.tags.length" class="hot-tag">{{ product.tags[0] }}</view>
              </view>
              <view class="hot-body">
                <text class="hot-name">{{ product.name }}</text>
                <view class="hot-bottom">
                  <text class="hot-price">{{ formatPrice(product.basePriceCents) }}</text>
                  <text class="hot-add">+</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="promise">
        <view class="promise-line"></view>
        <text class="promise-text">好咖啡，不需要等太久</text>
        <view class="promise-line"></view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 32rpx 72rpx;
  background:
    radial-gradient(circle at 88% 4%, rgba(192, 138, 90, 0.16), transparent 28%),
    linear-gradient(180deg, #fbf7f0 0%, #f5f1ea 48%, #f5f1ea 100%);
}

.hero {
  padding: 30rpx 4rpx 36rpx;
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 50rpx;
}

.brand-logo {
  display: block;
  width: 260rpx;
  height: auto;
}

.brand-pill {
  padding: 8rpx 18rpx;
  color: #6f4e37;
  font-size: 21rpx;
  letter-spacing: 1rpx;
  background: rgba(255, 253, 249, 0.7);
  border: 1rpx solid #e6dccf;
  border-radius: 999rpx;
}

.eyebrow {
  display: block;
  margin-bottom: 14rpx;
  color: #b07a4e;
  font-size: 20rpx;
  letter-spacing: 3rpx;
}

.title {
  display: block;
  color: #2b2118;
  font-size: 54rpx;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -1rpx;
}

.subtitle {
  display: block;
  max-width: 580rpx;
  margin-top: 16rpx;
  color: #7a6a5d;
  font-size: 25rpx;
  line-height: 1.7;
}

.state-card {
  padding: 44rpx 32rpx;
  background: #fffdf9;
  border: 1rpx solid #e6dccf;
  border-radius: 24rpx;
}

.skeleton-line {
  height: 24rpx;
  margin-bottom: 16rpx;
  background: #efe7dc;
  border-radius: 999rpx;
}

.skeleton-wide {
  width: 62%;
  height: 32rpx;
}

.skeleton-mid {
  width: 42%;
}

.skeleton-block {
  height: 180rpx;
  margin: 24rpx 0 18rpx;
  background: #f5efe6;
  border-radius: 18rpx;
}

.state-text {
  color: #a09487;
  font-size: 23rpx;
}

.state-title {
  display: block;
  color: #3d3026;
  font-size: 30rpx;
  font-weight: 600;
}

.state-desc {
  display: block;
  margin-top: 10rpx;
  color: #9b8b7d;
  font-size: 23rpx;
  line-height: 1.5;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 68rpx;
  padding: 0 28rpx;
  margin-top: 24rpx;
  color: #6f4e37;
  font-size: 24rpx;
  background: #efe4d8;
  border-radius: 999rpx;
}

.quick-row {
  display: flex;
  margin: 24rpx 4rpx 0;
}

.quick-item {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.quick-icon {
  font-size: 25rpx;
}

.quick-label {
  color: #8b7a6c;
  font-size: 21rpx;
}

.order-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
  margin-top: 30rpx;
  background: #2b2118;
  border-radius: 24rpx;
}

.cta-copy {
  flex: 1;
  min-width: 0;
}

.cta-title {
  display: block;
  color: #fffdf9;
  font-size: 30rpx;
  font-weight: 600;
}

.cta-desc {
  display: block;
  margin-top: 6rpx;
  color: #c9bdb1;
  font-size: 21rpx;
  line-height: 1.5;
}

.cta-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6rpx;
  height: 72rpx;
  padding: 0 24rpx;
  color: #2b2118;
  font-size: 25rpx;
  font-weight: 600;
  background: #f2d7b8;
  border-radius: 999rpx;
}

.cta-arrow {
  margin-top: -2rpx;
  font-size: 28rpx;
}

.section {
  margin-top: 48rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 0 4rpx 22rpx;
}

.section-eyebrow {
  display: block;
  margin-bottom: 6rpx;
  color: #b07a4e;
  font-size: 18rpx;
  letter-spacing: 3rpx;
}

.section-title {
  display: block;
  color: #2b2118;
  font-size: 38rpx;
  font-weight: 700;
}

.section-more {
  color: #8b7a6c;
  font-size: 22rpx;
}

.hot-scroll {
  width: 100%;
  white-space: nowrap;
}

.hot-track {
  display: inline-flex;
  gap: 18rpx;
  padding-bottom: 8rpx;
}

.hot-card {
  display: inline-block;
  width: 286rpx;
  overflow: hidden;
  vertical-align: top;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 22rpx;
}

.hot-media {
  position: relative;
  width: 100%;
  height: 204rpx;
  background: #efe4d8;
}

.hot-image {
  width: 100%;
  height: 100%;
}

.hot-sold-out {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fffdf9;
  font-size: 24rpx;
  background: rgba(43, 33, 24, 0.45);
}

.hot-tag {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  padding: 4rpx 12rpx;
  color: #6f4e37;
  font-size: 18rpx;
  background: rgba(255, 253, 249, 0.92);
  border-radius: 999rpx;
}

.hot-body {
  padding: 16rpx 18rpx 18rpx;
}

.hot-name {
  display: block;
  overflow: hidden;
  color: #3d3026;
  font-size: 26rpx;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hot-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.hot-price {
  color: #6f4e37;
  font-size: 27rpx;
  font-weight: 700;
}

.hot-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  color: #fffdf9;
  font-size: 28rpx;
  line-height: 1;
  background: #6f4e37;
  border-radius: 50%;
}

.promise {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: 58rpx;
}

.promise-line {
  width: 48rpx;
  height: 1rpx;
  background: #d8cbbd;
}

.promise-text {
  color: #b3a496;
  font-size: 20rpx;
  letter-spacing: 2rpx;
}
</style>
