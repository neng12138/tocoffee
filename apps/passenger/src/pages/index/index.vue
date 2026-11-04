<template>
  <view class="page">
    <view class="hero">
      <view class="brand-row">
        <view class="brand-mark">TC</view>
        <text class="brand-name">ToCoffee</text>
      </view>

      <text class="eyebrow">P0 · 单店自提</text>
      <text class="title">今天，喝杯好咖啡</text>
      <text class="subtitle">顾客端脚手架已就绪，菜单和点单从 Day 4 开始接入。</text>

      <view class="status-card">
        <view class="status-row">
          <text class="status-label">门店</text>
          <text class="status-value">ToCoffee 示例店</text>
        </view>
        <view class="status-row">
          <text class="status-label">营业时间</text>
          <text class="status-value">08:00 – 20:00</text>
        </view>
        <view class="status-row">
          <text class="status-label">当前阶段</text>
          <text class="status-value accent">Day 1 脚手架</text>
        </view>
      </view>

      <button class="primary-btn" disabled>菜单开发中</button>
      <text class="hint">H5 端口 5174 · 小程序构建见 README</text>
    </view>
  </view>
</template>

<script setup lang="ts">
// Day 1 只验证 uni-app 双端脚手架，不接业务数据。
</script>

<style>
.page {
  min-height: 100vh;
  padding: 48rpx 32rpx 64rpx;
  background: #f5f1ea;
}

.hero {
  padding: 40rpx 36rpx;
  background: #fffdf9;
  border: 1rpx solid #e6dccf;
  border-radius: 24rpx;
}

.brand-row {
  display: flex;
  align-items: center;
  margin-bottom: 48rpx;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-right: 20rpx;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  background: #6f4e37;
  border-radius: 20rpx;
}

.brand-name {
  color: #2b2118;
  font-size: 36rpx;
  font-weight: 700;
}

.eyebrow {
  display: block;
  margin-bottom: 16rpx;
  color: #c08a5a;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.title {
  display: block;
  margin-bottom: 16rpx;
  color: #2b2118;
  font-size: 52rpx;
  font-weight: 700;
  line-height: 1.25;
}

.subtitle {
  display: block;
  margin-bottom: 40rpx;
  color: #7a6a5d;
  font-size: 28rpx;
  line-height: 1.6;
}

.status-card {
  padding: 8rpx 24rpx;
  background: #f5f1ea;
  border-radius: 16rpx;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #e6dccf;
}

.status-row:last-child {
  border-bottom: none;
}

.status-label {
  color: #7a6a5d;
  font-size: 26rpx;
}

.status-value {
  color: #2b2118;
  font-size: 26rpx;
  font-weight: 500;
}

.status-value.accent {
  color: #6f4e37;
}

.primary-btn {
  margin-top: 40rpx;
  color: #ffffff;
  font-size: 30rpx;
  background: #6f4e37;
  border-radius: 44rpx;
}

.primary-btn[disabled] {
  color: #ffffff;
  background: #b9a18c;
}

.hint {
  display: block;
  margin-top: 24rpx;
  color: #9b8b7d;
  font-size: 22rpx;
  text-align: center;
}
</style>
