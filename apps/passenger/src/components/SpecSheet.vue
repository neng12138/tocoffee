<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product, SelectedOption, SpecGroup, SpecOption } from '@/types/catalog'
import { formatDelta, formatPrice } from '@/utils/money'
import QuantityStepper from './QuantityStepper.vue'

const props = defineProps<{
  visible: boolean
  product: Product | null
}>()

const emit = defineEmits<{
  close: []
  add: [payload: { optionIds: string[]; quantity: number }]
}>()

const selected = ref<Record<string, string[]>>({})
const quantity = ref(1)
const imageSrc = ref('')

const groups = computed<SpecGroup[]>(() => props.product?.specGroups ?? [])
const isSoldOut = computed(() => props.product?.status === 'SOLD_OUT')

const selectedOptions = computed<SelectedOption[]>(() => {
  const product = props.product
  if (!product) return []

  return product.specGroups.flatMap((group) => {
    const ids = selected.value[group.id] ?? []
    return group.options
      .filter((option) => ids.includes(option.id))
      .map((option) => ({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDeltaCents: option.priceDeltaCents,
      }))
  })
})

const unitPriceCents = computed(
  () =>
    (props.product?.basePriceCents ?? 0) +
    selectedOptions.value.reduce((sum, option) => sum + option.priceDeltaCents, 0),
)

const totalCents = computed(() => unitPriceCents.value * quantity.value)

const complete = computed(() =>
  groups.value.every((group) => {
    const count = selected.value[group.id]?.length ?? 0
    const min = group.required ? Math.max(1, group.minSelect) : group.minSelect
    const max = group.maxSelect > 0 ? group.maxSelect : Number.MAX_SAFE_INTEGER
    return count >= min && count <= max
  }),
)

const canAdd = computed(() => Boolean(props.product) && complete.value && !isSoldOut.value)

function groupMin(group: SpecGroup): number {
  return group.required ? Math.max(1, group.minSelect) : group.minSelect
}

function initSelection(): void {
  const product = props.product
  if (!product) return

  const next: Record<string, string[]> = {}
  for (const group of product.specGroups) {
    const min = groupMin(group)
    const max = group.maxSelect > 0 ? group.maxSelect : group.options.length
    const defaults = group.options.filter((option) => option.isDefault).map((option) => option.id)
    const chosen = defaults.slice(0, max)

    if (chosen.length < min) {
      for (const option of group.options) {
        if (chosen.length >= min) break
        if (!chosen.includes(option.id)) chosen.push(option.id)
      }
    }

    next[group.id] = chosen
  }

  selected.value = next
  quantity.value = 1
}

watch(
  () => [props.visible, props.product?.id] as const,
  ([visible]) => {
    if (!visible || !props.product) return
    imageSrc.value = props.product.imageUrl
    initSelection()
  },
  { immediate: true },
)

function isSelected(groupId: string, optionId: string): boolean {
  return selected.value[groupId]?.includes(optionId) ?? false
}

function toggleOption(group: SpecGroup, option: SpecOption): void {
  const current = selected.value[group.id] ?? []
  const isChosen = current.includes(option.id)
  const min = groupMin(group)

  if (group.multiSelect) {
    if (isChosen) {
      if (current.length <= min) return
      selected.value = { ...selected.value, [group.id]: current.filter((id) => id !== option.id) }
      return
    }

    if (group.maxSelect > 0 && current.length >= group.maxSelect) {
      uni.showToast({ title: `最多选 ${group.maxSelect} 项`, icon: 'none' })
      return
    }

    selected.value = { ...selected.value, [group.id]: [...current, option.id] }
    return
  }

  if (isChosen) {
    if (!group.required) selected.value = { ...selected.value, [group.id]: [] }
    return
  }

  selected.value = { ...selected.value, [group.id]: [option.id] }
}

function onImageError(): void {
  imageSrc.value = '/static/placeholder-product.png'
}

function onAdd(): void {
  if (!canAdd.value) return
  emit('add', {
    optionIds: selectedOptions.value.map((option) => option.optionId),
    quantity: quantity.value,
  })
}
</script>

<template>
  <view v-if="visible && product" class="sheet-mask" @click="emit('close')" @touchmove.stop.prevent>
    <view class="spec-sheet" @click.stop>
      <view class="sheet-grabber"></view>

      <view class="sheet-header">
        <view class="header-product">
          <image class="header-image" :src="imageSrc" mode="aspectFill" @error="onImageError" />
          <view class="header-copy">
            <text class="header-name">{{ product.name }}</text>
            <text class="header-desc">{{ product.description }}</text>
            <view class="header-price">
              <text class="header-currency">¥</text>
              <text class="header-amount">{{ formatPrice(product.basePriceCents).replace('¥', '') }}</text>
              <text class="header-from">起</text>
            </view>
          </view>
        </view>
        <view class="close-btn" @click="emit('close')">×</view>
      </view>

      <scroll-view class="spec-scroll" scroll-y>
        <view v-if="isSoldOut" class="sold-out-banner">该商品今日已售罄，暂时无法加入购物车</view>

        <view v-for="group in groups" :key="group.id" class="spec-group">
          <view class="group-head">
            <text class="group-name">{{ group.name }}</text>
            <text class="group-hint">
              {{ group.required ? '必选' : '可选' }}
              <text v-if="group.multiSelect && group.maxSelect > 0"> · 最多 {{ group.maxSelect }} 项</text>
            </text>
          </view>

          <view class="option-list">
            <view
              v-for="option in group.options"
              :key="option.id"
              class="option-chip"
              :class="{ 'is-selected': isSelected(group.id, option.id) }"
              @click="toggleOption(group, option)"
            >
              <text class="option-name">{{ option.name }}</text>
              <text v-if="option.priceDeltaCents" class="option-delta">
                {{ formatDelta(option.priceDeltaCents) }}
              </text>
            </view>
          </view>
        </view>

        <view class="quantity-row">
          <text class="quantity-label">数量</text>
          <QuantityStepper v-model="quantity" :min="1" :max="20" />
        </view>
      </scroll-view>

      <view class="sheet-footer">
        <view class="total-block">
          <text class="total-label">合计</text>
          <view class="total-price">
            <text class="total-currency">¥</text>
            <text class="total-amount">{{ formatPrice(totalCents).replace('¥', '') }}</text>
          </view>
        </view>
        <view class="add-to-cart" :class="{ 'is-disabled': !canAdd }" @click="onAdd">
          <text v-if="isSoldOut">已售罄</text>
          <text v-else-if="!complete">请选择完整规格</text>
          <text v-else>加入购物车</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  background: rgba(35, 25, 18, 0.46);
}

.spec-sheet {
  width: 100%;
  overflow: hidden;
  background: #fffdf9;
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 -12rpx 40rpx rgba(35, 25, 18, 0.15);
}

.sheet-grabber {
  width: 64rpx;
  height: 8rpx;
  margin: 16rpx auto 0;
  background: #e6dccf;
  border-radius: 999rpx;
}

.sheet-header {
  position: relative;
  padding: 28rpx 32rpx 20rpx;
}

.header-product {
  display: flex;
  gap: 22rpx;
}

.header-image {
  flex-shrink: 0;
  width: 168rpx;
  height: 168rpx;
  background: #efe4d8;
  border-radius: 20rpx;
}

.header-copy {
  flex: 1;
  min-width: 0;
  padding-right: 40rpx;
}

.header-name {
  display: block;
  color: #2b2118;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.35;
}

.header-desc {
  display: -webkit-box;
  margin-top: 8rpx;
  overflow: hidden;
  color: #8b7a6c;
  font-size: 23rpx;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.header-price {
  display: flex;
  align-items: baseline;
  margin-top: 10rpx;
  color: #6f4e37;
}

.header-currency {
  margin-right: 2rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.header-amount {
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1;
}

.header-from {
  margin-left: 4rpx;
  color: #9b8b7d;
  font-size: 20rpx;
}

.close-btn {
  position: absolute;
  top: 18rpx;
  right: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  color: #8b7a6c;
  font-size: 36rpx;
  line-height: 1;
  background: #f5f1ea;
  border-radius: 50%;
}

.spec-scroll {
  max-height: 54vh;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.sold-out-banner {
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  color: #a26b52;
  font-size: 23rpx;
  line-height: 1.5;
  background: #f7ebe4;
  border-radius: 14rpx;
}

.spec-group {
  padding-top: 24rpx;
  border-top: 1rpx solid #f1e9df;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.group-name {
  color: #3d3026;
  font-size: 28rpx;
  font-weight: 600;
}

.group-hint {
  color: #a09487;
  font-size: 21rpx;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding-bottom: 4rpx;
}

.option-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  min-width: 120rpx;
  padding: 16rpx 22rpx;
  color: #5f5045;
  font-size: 25rpx;
  background: #f7f2eb;
  border: 1rpx solid transparent;
  border-radius: 14rpx;
}

.option-chip.is-selected {
  color: #6f4e37;
  font-weight: 600;
  background: #efe4d8;
  border-color: #6f4e37;
}

.option-delta {
  color: #a26b52;
  font-size: 21rpx;
  font-weight: 400;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0 30rpx;
  margin-top: 24rpx;
  border-top: 1rpx solid #f1e9df;
}

.quantity-label {
  color: #3d3026;
  font-size: 28rpx;
  font-weight: 600;
}

.sheet-footer {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fffdf9;
  border-top: 1rpx solid #f1e9df;
}

.total-block {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2rpx;
}

.total-label {
  color: #a09487;
  font-size: 21rpx;
}

.total-price {
  display: flex;
  align-items: baseline;
  color: #6f4e37;
}

.total-currency {
  margin-right: 2rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.total-amount {
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.1;
}

.add-to-cart {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 300rpx;
  height: 88rpx;
  padding: 0 32rpx;
  color: #fffdf9;
  font-size: 29rpx;
  font-weight: 600;
  background: #6f4e37;
  border-radius: 999rpx;
  box-shadow: 0 10rpx 20rpx rgba(111, 78, 55, 0.24);
}

.add-to-cart.is-disabled {
  color: #fffdf9;
  background: #b9a18c;
  box-shadow: none;
}
</style>
