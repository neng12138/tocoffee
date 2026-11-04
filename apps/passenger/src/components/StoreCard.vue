<script setup lang="ts">
import { computed } from 'vue'
import type { StoreInfo } from '@/types/catalog'

const props = defineProps<{
  store: StoreInfo
}>()

const statusLabel = computed(() => (props.store.isOpen ? '营业中' : '休息中'))
const hoursLabel = computed(() => {
  const today = props.store.todayHours
  return today ? `${today.open} – ${today.close}` : '今日休息'
})
</script>

<template>
  <view class="store-card">
    <view class="store-head">
      <view class="store-copy">
        <view class="name-row">
          <text class="store-name">{{ store.name }}</text>
          <text class="status-pill" :class="{ 'is-closed': !store.isOpen }">{{ statusLabel }}</text>
        </view>
        <text class="store-address">{{ store.address }}</text>
      </view>
      <view class="store-mark">TC</view>
    </view>

    <view class="meta-row">
      <view class="meta-item">
        <text class="meta-label">今日营业</text>
        <text class="meta-value">{{ hoursLabel }}</text>
      </view>
      <view class="meta-divider"></view>
      <view class="meta-item">
        <text class="meta-label">取餐方式</text>
        <text class="meta-value">到店自提</text>
      </view>
      <view class="meta-divider"></view>
      <view class="meta-item">
        <text class="meta-label">预计制作</text>
        <text class="meta-value">{{ store.prepMinutes }} 分钟</text>
      </view>
    </view>

    <view class="notice">
      <text class="notice-dot">i</text>
      <text class="notice-text">{{ store.pickupNotice }}</text>
    </view>
  </view>
</template>

<style scoped>
.store-card {
  padding: 28rpx;
  background: #fffdf9;
  border: 1rpx solid #e6dccf;
  border-radius: 24rpx;
  box-shadow: 0 10rpx 30rpx rgba(94, 68, 48, 0.06);
}

.store-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.store-copy {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.store-name {
  color: #2b2118;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.3;
}

.status-pill {
  flex-shrink: 0;
  padding: 4rpx 14rpx;
  color: #4f7a5a;
  font-size: 20rpx;
  background: #eaf3ea;
  border-radius: 999rpx;
}

.status-pill.is-closed {
  color: #a26b52;
  background: #f7ebe4;
}

.store-address {
  display: block;
  margin-top: 8rpx;
  color: #8b7a6c;
  font-size: 24rpx;
  line-height: 1.5;
}

.store-mark {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  color: #6f4e37;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  background: #efe4d8;
  border-radius: 18rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  margin-top: 26rpx;
  padding: 20rpx 0;
  border-top: 1rpx solid #f0e8de;
  border-bottom: 1rpx solid #f0e8de;
}

.meta-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.meta-label {
  color: #a09487;
  font-size: 20rpx;
}

.meta-value {
  color: #3d3026;
  font-size: 24rpx;
  font-weight: 500;
}

.meta-divider {
  width: 1rpx;
  height: 44rpx;
  margin: 0 18rpx;
  background: #f0e8de;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 18rpx;
}

.notice-dot {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26rpx;
  height: 26rpx;
  margin-top: 2rpx;
  color: #fffdf9;
  font-size: 18rpx;
  font-weight: 600;
  background: #c08a5a;
  border-radius: 50%;
}

.notice-text {
  color: #8b7a6c;
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
