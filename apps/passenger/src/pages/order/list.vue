<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ApiClientError } from '@/api/client'
import { fetchOrders } from '@/api/orders'
import { useReorder } from '@/composables/useReorder'
import { useAuthStore } from '@/stores/auth'
import type { Order, OrderListTab, OrderStatus } from '@/types/order'
import { formatShanghaiDateTime, formatShanghaiTime } from '@/utils/datetime'
import { formatPrice } from '@/utils/money'

interface StatusMeta {
  label: string
  tone: string
}

const TABS: Array<{ key: OrderListTab; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING_PAYMENT', label: '待支付' },
  { key: 'ACTIVE', label: '进行中' },
  { key: 'FINISHED', label: '已完成' },
  { key: 'CANCELED', label: '已取消' },
]

const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: '待支付', tone: 'pending' },
  PAID: { label: '待接单', tone: 'paid' },
  ACCEPTED: { label: '制作中', tone: 'making' },
  READY: { label: '待取餐', tone: 'ready' },
  COMPLETED: { label: '已完成', tone: 'done' },
  NO_SHOW: { label: '未取餐', tone: 'muted' },
  CANCELED: { label: '已取消', tone: 'muted' },
  REFUNDING: { label: '退款中', tone: 'pending' },
  REFUNDED: { label: '已退款', tone: 'muted' },
}

const auth = useAuthStore()
const { reordering, reorder } = useReorder()

const activeTab = ref<OrderListTab>('ALL')
const orders = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
let initialized = false
let requestSeq = 0

const hasMore = computed(() => orders.value.length < total.value)
const isLoggedIn = computed(() => auth.isLoggedIn)
const activeTabLabel = computed(() => TABS.find((tab) => tab.key === activeTab.value)?.label ?? '全部')

const emptyCopy = computed(() => {
  if (activeTab.value === 'PENDING_PAYMENT') return '没有待支付的订单'
  if (activeTab.value === 'ACTIVE') return '没有进行中的订单'
  if (activeTab.value === 'FINISHED') return '还没有已完成的订单'
  if (activeTab.value === 'CANCELED') return '没有已取消的订单'
  return '还没有订单，去点一杯吧'
})

onShow(() => {
  if (!auth.isLoggedIn) {
    orders.value = []
    loading.value = false
    return
  }
  if (!initialized) {
    initialized = true
    void load(true)
  } else {
    void load(true, true)
  }
})

onReachBottom(() => {
  void loadMore()
})

onPullDownRefresh(() => {
  if (!auth.isLoggedIn) {
    uni.stopPullDownRefresh()
    return
  }
  void load(true, true).finally(() => uni.stopPullDownRefresh())
})

function statusMeta(status: OrderStatus): StatusMeta {
  return STATUS_META[status]
}

function switchTab(tab: OrderListTab): void {
  if (activeTab.value === tab) return
  activeTab.value = tab
  orders.value = []
  total.value = 0
  page.value = 1
  error.value = ''
  if (auth.isLoggedIn) void load(true)
}

async function load(reset = false, silent = false): Promise<void> {
  if (!auth.isLoggedIn) return
  if (loading.value && !reset) return

  const seq = ++requestSeq
  if (reset) {
    page.value = 1
    if (!silent) loading.value = true
  } else {
    loading.value = true
  }
  error.value = ''

  try {
    const result = await fetchOrders({
      tab: activeTab.value,
      page: page.value,
      pageSize,
    })
    if (seq !== requestSeq) return
    orders.value = reset ? result.items : [...orders.value, ...result.items]
    total.value = result.total
  } catch (err) {
    if (seq !== requestSeq) return
    if (err instanceof ApiClientError && err.statusCode === 401) {
      auth.logout()
      orders.value = []
      return
    }
    error.value = err instanceof ApiClientError ? err.message : '订单加载失败，请稍后重试'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!auth.isLoggedIn || loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  page.value += 1
  try {
    const result = await fetchOrders({
      tab: activeTab.value,
      page: page.value,
      pageSize,
    })
    orders.value = [...orders.value, ...result.items]
    total.value = result.total
  } catch (err) {
    page.value = Math.max(1, page.value - 1)
    uni.showToast({
      title: err instanceof ApiClientError ? err.message : '加载更多失败',
      icon: 'none',
    })
  } finally {
    loadingMore.value = false
  }
}

function goLogin(): void {
  uni.navigateTo({
    url: `/pages/login/login?redirect=${encodeURIComponent('/pages/order/list')}`,
  })
}

function goMenu(): void {
  uni.navigateTo({ url: '/pages/menu/menu' })
}

function goDetail(order: Order): void {
  uni.navigateTo({ url: `/pages/order/result?id=${order.id}` })
}

function goPay(order: Order): void {
  goDetail(order)
}

function itemSummary(order: Order): string {
  const names = order.items.map((item) => `${item.productName} ×${item.quantity}`)
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 件`
}

function pickupLabel(order: Order): string {
  if (order.pickupTimeType === 'SCHEDULED' && order.scheduledAt) {
    return `预约 ${formatShanghaiTime(order.scheduledAt)} 取餐`
  }
  return '到店自提'
}

async function reorderOrder(order: Order): Promise<void> {
  const added = await reorder(order)
  if (!added) return
  setTimeout(() => goMenu(), 350)
}
</script>

<template>
  <view class="orders-page">
    <view class="page-head">
      <text class="eyebrow">TOCOFFEE · MY ORDERS</text>
      <text class="title">我的订单</text>
      <text class="subtitle">每一杯，都有记录。</text>
    </view>

    <view v-if="!isLoggedIn" class="state-card">
      <text class="state-icon">☕</text>
      <text class="state-title">登录后查看订单</text>
      <text class="state-desc">手机号验证码登录，未注册会自动创建账号。</text>
      <view class="primary-btn" @click="goLogin">去登录</view>
    </view>

    <template v-else>
      <view class="tabs">
        <view
          v-for="tab in TABS"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>

      <view v-if="loading && !orders.length" class="state-card">
        <text class="state-icon">☕</text>
        <text class="state-title">正在整理订单</text>
        <text class="state-desc">稍等一下，马上就好。</text>
      </view>

      <view v-else-if="error && !orders.length" class="state-card">
        <text class="state-icon">…</text>
        <text class="state-title">网络开小差了</text>
        <text class="state-desc">{{ error }}</text>
        <view class="primary-btn" @click="load(true)">重新加载</view>
      </view>

      <view v-else-if="!orders.length" class="state-card">
        <text class="state-icon">☕</text>
        <text class="state-title">{{ emptyCopy }}</text>
        <text class="state-desc">{{ activeTabLabel }}里还没有记录，去菜单看看今天的咖啡。</text>
        <view class="primary-btn" @click="goMenu">去点单</view>
      </view>

      <template v-else>
        <view v-if="error" class="inline-error">
          <text>{{ error }}</text>
          <text class="inline-retry" @click="load(true)">重试</text>
        </view>

        <view v-for="order in orders" :key="order.id" class="order-card">
          <view class="card-head" @click="goDetail(order)">
            <view class="card-head-copy">
              <text class="order-no">{{ order.orderNo }}</text>
              <text class="order-time">{{ formatShanghaiDateTime(order.createdAt) }}</text>
            </view>
            <text class="status-tag" :class="`tone-${statusMeta(order.status).tone}`">
              {{ statusMeta(order.status).label }}
            </text>
          </view>

          <view class="card-body" @click="goDetail(order)">
            <view class="pickup-row">
              <text class="pickup-label">{{ pickupLabel(order) }}</text>
              <text v-if="order.pickupCode && order.status !== 'CANCELED'" class="pickup-code">
                取餐码 {{ order.pickupCode }}
              </text>
            </view>
            <text class="item-summary">{{ itemSummary(order) }}</text>
            <view class="amount-row">
              <text class="amount-label">共 {{ order.items.length }} 项</text>
              <text class="amount">{{ formatPrice(order.paidCents || order.payableCents) }}</text>
            </view>
          </view>

          <view class="card-actions">
            <view class="action-ghost" @click.stop="goDetail(order)">查看详情</view>
            <view
              v-if="order.status === 'PENDING_PAYMENT'"
              class="action-primary"
              @click.stop="goPay(order)"
            >
              去支付
            </view>
            <view
              v-else-if="order.status === 'COMPLETED' || order.status === 'CANCELED' || order.status === 'REFUNDED'"
              class="action-primary"
              :class="{ disabled: reordering }"
              @click.stop="reorderOrder(order)"
            >
              {{ reordering ? '加入中…' : '再来一单' }}
            </view>
            <view v-else class="action-primary" @click.stop="goDetail(order)">
              {{ order.status === 'READY' ? '查看取餐码' : '查看进度' }}
            </view>
          </view>
        </view>

        <view class="list-footer">
          <text v-if="loadingMore">正在加载更多…</text>
          <text v-else-if="hasMore" @click="loadMore">加载更多</text>
          <text v-else>没有更多订单了</text>
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped>
.orders-page {
  min-height: 100vh;
  padding: 0 32rpx 60rpx;
  background:
    radial-gradient(circle at 90% 2%, rgba(192, 138, 90, 0.14), transparent 30%),
    #f5f1ea;
}

.page-head {
  padding: 42rpx 4rpx 26rpx;
}

.eyebrow {
  display: block;
  color: #b07a4e;
  font-size: 20rpx;
  letter-spacing: 3rpx;
}

.title {
  display: block;
  margin-top: 10rpx;
  color: #2b2118;
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  color: #8a7866;
  font-size: 24rpx;
}

.tabs {
  display: flex;
  padding: 6rpx;
  margin-bottom: 22rpx;
  overflow-x: auto;
  background: rgba(255, 253, 249, 0.78);
  border: 1rpx solid #e7ddcf;
  border-radius: 999rpx;
  white-space: nowrap;
}

.tab-item {
  flex: 1;
  min-width: 108rpx;
  padding: 16rpx 8rpx;
  color: #8a7866;
  font-size: 23rpx;
  text-align: center;
  border-radius: 999rpx;
}

.tab-item.active {
  color: #fffdf9;
  font-weight: 600;
  background: #2b2118;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 48rpx;
  background: #fffdf9;
  border: 1rpx solid #e7ddcf;
  border-radius: 28rpx;
}

.state-icon {
  font-size: 64rpx;
}

.state-title {
  margin-top: 18rpx;
  color: #3a2c20;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.state-desc {
  max-width: 520rpx;
  margin-top: 12rpx;
  color: #9b8a78;
  font-size: 23rpx;
  line-height: 1.7;
  text-align: center;
}

.primary-btn {
  padding: 18rpx 42rpx;
  margin-top: 30rpx;
  color: #fffdf9;
  font-size: 25rpx;
  background: #2b2118;
  border-radius: 999rpx;
}

.inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  margin-bottom: 18rpx;
  color: #a34e36;
  font-size: 22rpx;
  background: #fff3ed;
  border: 1rpx solid #f0d3c8;
  border-radius: 16rpx;
}

.inline-retry {
  color: #8b3d27;
  font-weight: 600;
}

.order-card {
  margin-bottom: 20rpx;
  overflow: hidden;
  background: #fffdf9;
  border: 1rpx solid #e7ddcf;
  border-radius: 26rpx;
  box-shadow: 0 12rpx 32rpx rgba(68, 47, 30, 0.05);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24rpx 26rpx 0;
}

.card-head-copy {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.order-no {
  color: #5f4a36;
  font-size: 21rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.order-time {
  color: #a49380;
  font-size: 21rpx;
}

.status-tag {
  padding: 6rpx 16rpx;
  font-size: 21rpx;
  border-radius: 999rpx;
}

.tone-pending {
  color: #98672b;
  background: #fbefd9;
}

.tone-paid {
  color: #6d5437;
  background: #f2e8da;
}

.tone-making {
  color: #8a5d2c;
  background: #f8e5cd;
}

.tone-ready {
  color: #2e6b4e;
  background: #e3f2e8;
}

.tone-done {
  color: #5d6b5f;
  background: #edf1eb;
}

.tone-muted {
  color: #8b8177;
  background: #f0ece6;
}

.card-body {
  padding: 20rpx 26rpx 22rpx;
}

.pickup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.pickup-label {
  color: #7c6752;
  font-size: 23rpx;
}

.pickup-code {
  color: #2e6b4e;
  font-size: 23rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.item-summary {
  display: block;
  overflow: hidden;
  color: #3a2c20;
  font-size: 27rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 14rpx;
}

.amount-label {
  color: #a49380;
  font-size: 21rpx;
}

.amount {
  color: #2b2118;
  font-size: 30rpx;
  font-weight: 700;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  padding: 18rpx 26rpx;
  border-top: 1rpx solid #f1e9de;
}

.action-ghost,
.action-primary {
  padding: 14rpx 26rpx;
  font-size: 23rpx;
  border-radius: 999rpx;
}

.action-ghost {
  color: #7c6752;
  border: 1rpx solid #ded2c2;
}

.action-primary {
  color: #fffdf9;
  background: #2b2118;
}

.action-primary.disabled {
  opacity: 0.55;
}

.list-footer {
  padding: 28rpx 0 12rpx;
  color: #a49380;
  font-size: 22rpx;
  text-align: center;
}
</style>
