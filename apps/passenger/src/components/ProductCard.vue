<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product } from '@/types/catalog'
import { formatPrice } from '@/utils/money'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  select: [product: Product]
}>()

const imageSrc = ref(props.product.imageUrl)

watch(
  () => props.product.imageUrl,
  (value) => {
    imageSrc.value = value
  },
)

const isSoldOut = computed(() => props.product.status === 'SOLD_OUT')
const tags = computed(() => props.product.tags.slice(0, 2))
const hasPaidOptions = computed(() =>
  props.product.specGroups.some((group) => group.options.some((option) => option.priceDeltaCents > 0)),
)

function onImageError(): void {
  imageSrc.value = '/static/placeholder-product.png'
}

function onSelect(): void {
  emit('select', props.product)
}
</script>

<template>
  <view class="product-card" :class="{ 'is-sold-out': isSoldOut }" @click="onSelect">
    <view class="product-media">
      <image class="product-image" :src="imageSrc" mode="aspectFill" @error="onImageError" />
      <view v-if="isSoldOut" class="sold-out-mask">
        <text class="sold-out-text">售罄</text>
      </view>
      <view v-if="tags.length" class="tag-row">
        <text v-for="tag in tags" :key="tag" class="tag">{{ tag }}</text>
      </view>
    </view>

    <view class="product-body">
      <text class="product-name">{{ product.name }}</text>
      <text class="product-desc">{{ product.description }}</text>

      <view class="product-footer">
        <view class="price-row">
          <text class="currency">¥</text>
          <text class="amount">{{ formatPrice(product.basePriceCents).replace('¥', '') }}</text>
          <text v-if="hasPaidOptions" class="price-from">起</text>
        </view>
        <view class="add-btn" :class="{ 'is-disabled': isSoldOut }" @click.stop="onSelect">
          <text v-if="!isSoldOut" class="add-icon">+</text>
          <text v-else class="add-text">沽清</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.product-card {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 24rpx;
}

.product-card.is-sold-out {
  opacity: 0.72;
}

.product-media {
  position: relative;
  flex-shrink: 0;
  width: 184rpx;
  height: 184rpx;
  overflow: hidden;
  background: #efe4d8;
  border-radius: 18rpx;
}

.product-image {
  width: 100%;
  height: 100%;
}

.sold-out-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(43, 33, 24, 0.42);
}

.sold-out-text {
  padding: 8rpx 18rpx;
  color: #fffdf9;
  font-size: 24rpx;
  letter-spacing: 2rpx;
  background: rgba(43, 33, 24, 0.7);
  border-radius: 999rpx;
}

.tag-row {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  display: flex;
  gap: 6rpx;
}

.tag {
  padding: 4rpx 10rpx;
  color: #6f4e37;
  font-size: 18rpx;
  line-height: 1.4;
  background: rgba(255, 253, 249, 0.9);
  border-radius: 999rpx;
}

.product-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.product-name {
  color: #2b2118;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
}

.product-desc {
  display: -webkit-box;
  margin-top: 8rpx;
  overflow: hidden;
  color: #8b7a6c;
  font-size: 23rpx;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.product-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 12rpx;
}

.price-row {
  display: flex;
  align-items: baseline;
  color: #6f4e37;
}

.currency {
  margin-right: 2rpx;
  font-size: 23rpx;
  font-weight: 600;
}

.amount {
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1;
}

.price-from {
  margin-left: 4rpx;
  color: #9b8b7d;
  font-size: 20rpx;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  color: #fffdf9;
  background: #6f4e37;
  border-radius: 50%;
  box-shadow: 0 6rpx 14rpx rgba(111, 78, 55, 0.22);
}

.add-btn.is-disabled {
  width: auto;
  padding: 0 14rpx;
  background: #b9a18c;
  border-radius: 999rpx;
  box-shadow: none;
}

.add-icon {
  margin-top: -4rpx;
  font-size: 38rpx;
  line-height: 1;
}

.add-text {
  font-size: 20rpx;
}
</style>
