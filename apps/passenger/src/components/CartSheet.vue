<script setup lang="ts">
import type { CartItem } from '@/stores/cart'
import { formatPrice } from '@/utils/money'
import QuantityStepper from './QuantityStepper.vue'

defineProps<{
  visible: boolean
  items: CartItem[]
  totalCents: number
  totalQuantity: number
}>()

const emit = defineEmits<{
  close: []
  change: [payload: { key: string; quantity: number }]
  remove: [key: string]
  clear: []
  checkout: []
}>()

function onClear(): void {
  uni.showModal({
    title: '清空购物车',
    content: '确定要清空当前购物车吗？',
    confirmColor: '#6f4e37',
    success: (result) => {
      if (result.confirm) emit('clear')
    },
  })
}
</script>

<template>
  <view v-if="visible" class="cart-mask" @click="emit('close')" @touchmove.stop.prevent>
    <view class="cart-sheet" @click.stop>
      <view class="sheet-grabber"></view>

      <view class="cart-head">
        <view>
          <text class="cart-title">购物车</text>
          <text class="cart-count">共 {{ totalQuantity }} 件</text>
        </view>
        <text v-if="items.length" class="clear-btn" @click="onClear">清空</text>
      </view>

      <scroll-view v-if="items.length" class="cart-list" scroll-y>
        <view v-for="item in items" :key="item.key" class="cart-item">
          <image class="cart-image" :src="item.imageUrl" mode="aspectFill" />
          <view class="cart-copy">
            <text class="cart-name">{{ item.productName }}</text>
            <text class="cart-spec">{{ item.optionNames.join(' / ') || '默认规格' }}</text>
            <view class="cart-line-bottom">
              <text class="cart-price">{{ formatPrice(item.unitPriceCents) }}</text>
              <QuantityStepper
                :model-value="item.quantity"
                :min="1"
                :max="20"
                small
                @update:model-value="(value) => emit('change', { key: item.key, quantity: value })"
              />
            </view>
          </view>
          <text class="remove-btn" @click="emit('remove', item.key)">×</text>
        </view>
      </scroll-view>

      <view v-else class="empty-cart">
        <text class="empty-icon">☕</text>
        <text class="empty-title">购物车还是空的</text>
        <text class="empty-desc">去菜单挑一杯今天想喝的咖啡吧</text>
      </view>

      <view class="cart-footer">
        <view class="footer-total">
          <text class="footer-label">合计</text>
          <view class="footer-price">
            <text class="footer-currency">¥</text>
            <text class="footer-amount">{{ formatPrice(totalCents).replace('¥', '') }}</text>
          </view>
        </view>
        <view class="checkout-btn" :class="{ 'is-disabled': !items.length }" @click="items.length && emit('checkout')">
          去结算
        </view>
      </view>
      <text class="footer-note">价格以结算页为准 · 到店自提</text>
    </view>
  </view>
</template>

<style scoped>
.cart-mask {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: flex-end;
  background: rgba(35, 25, 18, 0.46);
}

.cart-sheet {
  width: 100%;
  overflow: hidden;
  background: #fffdf9;
  border-radius: 32rpx 32rpx 0 0;
}

.sheet-grabber {
  width: 64rpx;
  height: 8rpx;
  margin: 16rpx auto 0;
  background: #e6dccf;
  border-radius: 999rpx;
}

.cart-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 24rpx 32rpx 18rpx;
}

.cart-title {
  color: #2b2118;
  font-size: 34rpx;
  font-weight: 700;
}

.cart-count {
  margin-left: 12rpx;
  color: #a09487;
  font-size: 22rpx;
}

.clear-btn {
  color: #a26b52;
  font-size: 23rpx;
}

.cart-list {
  max-height: 52vh;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.cart-item {
  position: relative;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
  border-top: 1rpx solid #f1e9df;
}

.cart-image {
  flex-shrink: 0;
  width: 112rpx;
  height: 112rpx;
  background: #efe4d8;
  border-radius: 16rpx;
}

.cart-copy {
  flex: 1;
  min-width: 0;
  padding-right: 34rpx;
}

.cart-name {
  display: block;
  color: #3d3026;
  font-size: 27rpx;
  font-weight: 600;
}

.cart-spec {
  display: block;
  margin-top: 6rpx;
  overflow: hidden;
  color: #9b8b7d;
  font-size: 21rpx;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cart-line-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.cart-price {
  color: #6f4e37;
  font-size: 28rpx;
  font-weight: 700;
}

.remove-btn {
  position: absolute;
  top: 16rpx;
  right: 0;
  color: #b9a18c;
  font-size: 32rpx;
  line-height: 1;
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 32rpx 42rpx;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  margin-bottom: 18rpx;
  font-size: 44rpx;
  background: #f5f1ea;
  border-radius: 50%;
}

.empty-title {
  color: #3d3026;
  font-size: 28rpx;
  font-weight: 600;
}

.empty-desc {
  margin-top: 8rpx;
  color: #a09487;
  font-size: 22rpx;
}

.cart-footer {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 18rpx 32rpx 0;
  border-top: 1rpx solid #f1e9df;
}

.footer-total {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2rpx;
}

.footer-label {
  color: #a09487;
  font-size: 21rpx;
}

.footer-price {
  display: flex;
  align-items: baseline;
  color: #6f4e37;
}

.footer-currency {
  margin-right: 2rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.footer-amount {
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.1;
}

.checkout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 300rpx;
  height: 88rpx;
  color: #fffdf9;
  font-size: 29rpx;
  font-weight: 600;
  background: #6f4e37;
  border-radius: 999rpx;
}

.checkout-btn.is-disabled {
  background: #b9a18c;
}

.footer-note {
  display: block;
  padding: 10rpx 0 calc(18rpx + env(safe-area-inset-bottom));
  color: #b9a18c;
  font-size: 19rpx;
  text-align: center;
}
</style>
