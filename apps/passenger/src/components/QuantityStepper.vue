<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    small?: boolean
  }>(),
  {
    min: 1,
    max: 20,
    small: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function change(delta: number): void {
  const next = Math.min(props.max, Math.max(props.min, props.modelValue + delta))
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <view class="stepper" :class="{ 'is-small': small }">
    <view
      class="stepper-btn"
      :class="{ 'is-disabled': modelValue <= min }"
      @click.stop="change(-1)"
    >
      −
    </view>
    <text class="stepper-value">{{ modelValue }}</text>
    <view
      class="stepper-btn"
      :class="{ 'is-disabled': modelValue >= max }"
      @click.stop="change(1)"
    >
      +
    </view>
  </view>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  color: #6f4e37;
  font-size: 34rpx;
  line-height: 1;
  background: #f5f1ea;
  border: 1rpx solid #e6dccf;
  border-radius: 50%;
}

.stepper-btn.is-disabled {
  color: #c9bdb1;
  background: #faf7f2;
}

.stepper-value {
  min-width: 48rpx;
  color: #2b2118;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}

.stepper.is-small .stepper-btn {
  width: 42rpx;
  height: 42rpx;
  font-size: 28rpx;
}

.stepper.is-small .stepper-value {
  min-width: 38rpx;
  font-size: 24rpx;
}
</style>
