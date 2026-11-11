<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { ApiClientError } from '@/api/client'
import { fetchStore } from '@/api/catalog'
import { fetchOrder, payOrder } from '@/api/orders'
import { useReorder } from '@/composables/useReorder'
import { useAuthStore } from '@/stores/auth'
import type { StoreInfo } from '@/types/catalog'
import type { Order, OrderEvent, OrderStatus } from '@/types/order'
import { formatShanghaiDateTime, formatShanghaiTime } from '@/utils/datetime'
import { formatPrice } from '@/utils/money'

const STATUS_META: Record<OrderStatus, { title: string; desc: string; tone: string }> = {
  PENDING_PAYMENT: { title: '待支付', desc: '支付成功后才会生成取餐码。', tone: 'pending' },
  PAID: { title: '支付成功', desc: '门店已收到订单，请按预计时间到店取餐。', tone: 'success' },
  ACCEPTED: { title: '制作中', desc: '咖啡师正在为你制作，稍等一下。', tone: 'making' },
  READY: { title: '请取餐', desc: '饮品已出杯，凭取餐码到吧台领取。', tone: 'ready' },
  COMPLETED: { title: '已完成', desc: '这杯咖啡已经取走，祝你今天愉快。', tone: 'done' },
  NO_SHOW: { title: '未取餐', desc: '订单已过营业时间，请联系门店处理。', tone: 'muted' },
  CANCELED: { title: '已取消', desc: '订单已取消，未支付的订单不会进入制作。', tone: 'muted' },
  REFUNDING: { title: '退款中', desc: '退款正在处理，请留意到账通知。', tone: 'pending' },
  REFUNDED: { title: '已退款', desc: '退款已完成。', tone: 'muted' },
}

const EVENT_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '订单已创建',
  PAID: '支付成功',
  ACCEPTED: '门店已接单',
  READY: '咖啡已出杯',
  COMPLETED: '订单已完成',
  NO_SHOW: '超时未取，订单关闭',
  CANCELED: '订单已取消',
  REFUNDING: '退款处理中',
  REFUNDED: '退款已完成',
}

const POLLING_STATUSES = new Set<OrderStatus>([
  'PENDING_PAYMENT',
  'PAID',
  'ACCEPTED',
  'READY',
])

const auth = useAuthStore()
const { reordering, reorder } = useReorder()
const store = ref<StoreInfo | null>(null)
const orderId = ref('')
const order = ref<Order | null>(null)
const loading = ref(true)
const paying = ref(false)
const error = ref('')
let loaded = false
let pollTimer: ReturnType<typeof setInterval> | null = null

const meta = computed(() => (order.value ? STATUS_META[order.value.status] : null))
const isPending = computed(() => order.value?.status === 'PENDING_PAYMENT')
const readyLabel = computed(() => {
  if (!order.value?.estimatedReadyAt) return ''
  return order.value.pickupTimeType === 'SCHEDULED'
    ? `预约 ${formatShanghaiTime(order.value.estimatedReadyAt)} 取餐`
    : `预计 ${formatShanghaiTime(order.value.estimatedReadyAt)} 出杯`
})

onLoad((query) => {
  orderId.value = typeof query?.id === 'string' ? query.id : ''
  void loadStore()
})

onShow(() => {
  if (!auth.isLoggedIn) {
    redirectToLogin()
    return
  }
  if (!orderId.value) {
    error.value = '缺少订单信息'
    loading.value = false
    return
  }
  if (!loaded) {
    loaded = true
    void loadOrder()
  } else {
    void loadOrder(true)
  }
})

onHide(() => {
  stopPolling()
})

onUnmounted(() => {
  stopPolling()
})

async function loadStore(): Promise<void> {
  try {
    store.value = await fetchStore()
  } catch {
    // 门店信息失败不阻塞订单主流程。
  }
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function syncPolling(): void {
  stopPolling()
  if (!order.value || !POLLING_STATUSES.has(order.value.status)) return
  pollTimer = setInterval(() => {
    void loadOrder(true)
  }, 5000)
}

async function loadOrder(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const previousStatus = order.value?.status
    const next = await fetchOrder(orderId.value)
    order.value = next
    if (silent && previousStatus && previousStatus !== next.status) {
      uni.showToast({ title: STATUS_META[next.status].title, icon: 'none' })
    }
    syncPolling()
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 401) {
      stopPolling()
      auth.logout()
      redirectToLogin()
      return
    }
    if (!silent) {
      error.value = err instanceof ApiClientError ? err.message : '订单加载失败'
    }
  } finally {
    loading.value = false
  }
}

async function pay(): Promise<void> {
  if (!order.value || paying.value) return
  paying.value = true
  error.value = ''
  try {
    order.value = await payOrder(order.value.id)
    syncPolling()
    uni.showToast({ title: '支付成功', icon: 'success' })
  } catch (err) {
    error.value = err instanceof ApiClientError ? err.message : '支付失败，请稍后再试'
  } finally {
    paying.value = false
  }
}

function redirectToLogin(): void {
  uni.redirectTo({
    url: `/pages/login/login?redirect=${encodeURIComponent(
      `/pages/order/result?id=${orderId.value}`,
    )}`,
  })
}

function goHome(): void {
  uni.reLaunch({ url: '/pages/index/index' })
}

function goMenu(): void {
  uni.redirectTo({ url: '/pages/menu/menu' })
}

function goOrders(): void {
  uni.navigateTo({ url: '/pages/order/list' })
}

async function reorderOrder(): Promise<void> {
  if (!order.value) return
  const added = await reorder(order.value)
  if (added) goMenu()
}

function callStore(): void {
  if (!store.value?.phone) return
  uni.makePhoneCall({ phoneNumber: store.value.phone })
}

function eventTitle(event: OrderEvent): string {
  if (event.fromStatus === 'PAID' && event.toStatus === 'PAID') return '预约已释放'
  return EVENT_LABELS[event.toStatus]
}
</script>

<template>
  <view class="result-page">
    <view v-if="loading" class="state-block">
      <text class="state-icon">☕</text>
      <text class="state-title">正在查询订单</text>
    </view>

    <view v-else-if="error && !order" class="state-block">
      <text class="state-title">订单没有加载出来</text>
      <text class="state-desc">{{ error }}</text>
      <view class="state-btn" @click="loadOrder()">重新加载</view>
    </view>

    <template v-else-if="order && meta">
      <view class="hero" :class="`tone-${meta.tone}`">
        <text class="hero-kicker">TOCOFFEE · ORDER</text>
        <text class="hero-title">{{ meta.title }}</text>
        <text class="hero-desc">{{ meta.desc }}</text>

        <view v-if="order.pickupCode" class="pickup-box">
          <text class="pickup-label">取餐码</text>
          <text class="pickup-code">{{ order.pickupCode }}</text>
          <text class="pickup-hint">到店后向店员出示此号码</text>
        </view>

        <view v-else-if="isPending" class="pending-box">
          <text class="pending-title">订单已创建，等待支付</text>
          <text class="pending-desc">请在 {{ formatShanghaiDateTime(order.expiresAt) }} 前完成支付</text>
          <view class="pending-pay" :class="{ 'is-loading': paying }" @click="pay">
            {{ paying ? '支付中…' : `支付 ${formatPrice(order.payableCents)}` }}
          </view>
        </view>

        <view v-if="readyLabel" class="eta-pill">{{ readyLabel }}</view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">取餐信息</text>
          <text class="refresh" @click="loadOrder()">刷新</text>
        </view>
        <view class="info-row">
          <text class="info-label">门店</text>
          <text class="info-value">{{ store?.name || 'ToCoffee 示例店' }}</text>
        </view>
        <view v-if="store?.address" class="info-row">
          <text class="info-label">地址</text>
          <text class="info-value">{{ store.address }}</text>
        </view>
        <view v-if="store?.phone" class="info-row">
          <text class="info-label">电话</text>
          <text class="info-value info-link" @click="callStore">{{ store.phone }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">方式</text>
          <text class="info-value">到店自提 · {{ order.pickupTimeType === 'SCHEDULED' ? '预约' : '立即' }}</text>
        </view>
        <view v-if="order.scheduledAt" class="info-row">
          <text class="info-label">预约时间</text>
          <text class="info-value">{{ formatShanghaiDateTime(order.scheduledAt) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value info-mono">{{ order.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ formatShanghaiDateTime(order.createdAt) }}</text>
        </view>
      </view>

      <view v-if="order.events.length" class="section-card">
        <view class="section-head">
          <text class="section-title">订单进度</text>
          <text class="section-meta">每 5 秒自动更新</text>
        </view>
        <view v-for="(event, index) in order.events" :key="event.id" class="timeline-item">
          <view class="timeline-axis">
            <view
              class="timeline-dot"
              :class="{ current: index === order.events.length - 1 }"
            ></view>
            <view v-if="index < order.events.length - 1" class="timeline-line"></view>
          </view>
          <view class="timeline-copy">
            <text class="timeline-title">{{ eventTitle(event) }}</text>
            <text class="timeline-time">{{ formatShanghaiDateTime(event.createdAt) }}</text>
            <text
              v-if="event.note && event.note !== eventTitle(event)"
              class="timeline-note"
            >
              {{ event.note }}
            </text>
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">商品明细</text>
          <text class="section-meta">{{ order.items.length }} 项</text>
        </view>
        <view v-for="item in order.items" :key="item.id" class="order-item">
          <image v-if="item.productImage" class="item-image" :src="item.productImage" mode="aspectFill" />
          <view v-else class="item-image item-image-fallback">☕</view>
          <view class="item-copy">
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-spec">{{ item.specText }}</text>
            <text class="item-qty">× {{ item.quantity }}</text>
          </view>
          <text class="item-total">{{ formatPrice(item.totalCents) }}</text>
        </view>
        <view class="total-row">
          <text>实付</text>
          <text class="total-amount">{{ formatPrice(order.paidCents || order.payableCents) }}</text>
        </view>
        <text v-if="order.remark" class="remark">备注：{{ order.remark }}</text>
      </view>

      <view v-if="error" class="error-card">{{ error }}</view>

      <view class="actions">
        <view
          class="action-secondary"
          :class="{ 'is-loading': reordering }"
          @click="reorderOrder"
        >
          {{ reordering ? '加入中…' : '再来一单' }}
        </view>
        <view class="action-secondary" @click="goOrders">全部订单</view>
        <view class="action-primary" @click="goHome">返回首页</view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.result-page {
  min-height: 100vh;
  padding-bottom: 60rpx;
  background:
    radial-gradient(circle at 12% 0%, rgba(214, 184, 145, 0.24), transparent 32%),
    #f5f1ea;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx;
}

.state-icon {
  font-size: 72rpx;
}

.state-title {
  margin-top: 20rpx;
  color: #3a2c20;
  font-size: 32rpx;
  font-weight: 700;
}

.state-desc {
  margin-top: 12rpx;
  color: #9b8a78;
  font-size: 24rpx;
  text-align: center;
}

.state-btn {
  padding: 18rpx 36rpx;
  margin-top: 30rpx;
  color: #fffdf9;
  font-size: 26rpx;
  background: #2b2118;
  border-radius: 999rpx;
}

.hero {
  margin: 16rpx 24rpx 0;
  padding: 34rpx 30rpx;
  color: #fffdf9;
  background: #2b2118;
  border-radius: 30rpx;
  box-shadow: 0 20rpx 48rpx rgba(43, 33, 24, 0.18);
}

.hero.tone-success,
.hero.tone-ready {
  background: linear-gradient(135deg, #4e6b4c, #2f4732);
}

.hero.tone-making {
  background: linear-gradient(135deg, #8a5f3f, #5f402b);
}

.hero.tone-muted {
  background: #6f655b;
}

.hero-kicker {
  display: block;
  color: rgba(255, 253, 249, 0.62);
  font-size: 19rpx;
  letter-spacing: 4rpx;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.hero-desc {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 253, 249, 0.72);
  font-size: 24rpx;
  line-height: 1.55;
}

.pickup-box {
  margin-top: 30rpx;
  padding: 24rpx;
  text-align: center;
  background: rgba(255, 253, 249, 0.1);
  border: 1rpx solid rgba(255, 253, 249, 0.18);
  border-radius: 24rpx;
}

.pickup-label {
  display: block;
  color: rgba(255, 253, 249, 0.66);
  font-size: 22rpx;
  letter-spacing: 4rpx;
}

.pickup-code {
  display: block;
  margin-top: 4rpx;
  font-size: 92rpx;
  font-weight: 800;
  letter-spacing: 12rpx;
  line-height: 1.1;
}

.pickup-hint {
  display: block;
  margin-top: 6rpx;
  color: rgba(255, 253, 249, 0.6);
  font-size: 21rpx;
}

.pending-box {
  margin-top: 28rpx;
  padding: 24rpx;
  background: rgba(255, 253, 249, 0.1);
  border-radius: 22rpx;
}

.pending-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
}

.pending-desc {
  display: block;
  margin-top: 6rpx;
  color: rgba(255, 253, 249, 0.66);
  font-size: 21rpx;
}

.pending-pay {
  padding: 20rpx;
  margin-top: 20rpx;
  color: #2b2118;
  font-size: 27rpx;
  font-weight: 700;
  text-align: center;
  background: #fffdf9;
  border-radius: 999rpx;
}

.pending-pay.is-loading {
  opacity: 0.6;
}

.eta-pill {
  display: inline-block;
  padding: 10rpx 20rpx;
  margin-top: 20rpx;
  color: #fffdf9;
  font-size: 22rpx;
  background: rgba(255, 253, 249, 0.14);
  border: 1rpx solid rgba(255, 253, 249, 0.18);
  border-radius: 999rpx;
}

.section-card {
  margin: 20rpx 24rpx 0;
  padding: 26rpx;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 26rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.section-title {
  color: #2b2118;
  font-size: 28rpx;
  font-weight: 700;
}

.section-meta {
  color: #a08d7b;
  font-size: 22rpx;
}

.refresh {
  color: #6f4e37;
  font-size: 22rpx;
  font-weight: 600;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-top: 1rpx solid #f1e9de;
}

.info-row:first-of-type {
  border-top: none;
}

.info-label {
  color: #9a8876;
  font-size: 23rpx;
}

.info-value {
  max-width: 70%;
  color: #3a2c20;
  font-size: 24rpx;
  text-align: right;
}

.info-mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 21rpx;
}

.info-link {
  color: #6f4e37;
  text-decoration: underline;
}

.timeline-item {
  display: flex;
  gap: 16rpx;
  min-height: 58rpx;
}

.timeline-axis {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 22rpx;
  flex-shrink: 0;
}

.timeline-dot {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  margin-top: 10rpx;
  background: #d8c8b6;
  border-radius: 50%;
}

.timeline-dot.current {
  background: #2e6b4e;
  box-shadow: 0 0 0 6rpx rgba(46, 107, 78, 0.12);
}

.timeline-line {
  flex: 1;
  width: 2rpx;
  min-height: 42rpx;
  margin-top: 6rpx;
  background: #eadfd2;
}

.timeline-copy {
  flex: 1;
  padding-bottom: 20rpx;
}

.timeline-title {
  display: block;
  color: #3a2c20;
  font-size: 24rpx;
  font-weight: 600;
}

.timeline-time {
  display: block;
  margin-top: 4rpx;
  color: #a49380;
  font-size: 20rpx;
}

.timeline-note {
  display: block;
  margin-top: 4rpx;
  color: #9a8876;
  font-size: 21rpx;
  line-height: 1.5;
}

.order-item {
  display: flex;
  gap: 18rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f1e9de;
}

.order-item:first-of-type {
  border-top: none;
}

.item-image {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  background: #f0e7da;
  border-radius: 16rpx;
}

.item-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}

.item-copy {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  color: #2b2118;
  font-size: 26rpx;
  font-weight: 600;
}

.item-spec {
  display: block;
  margin-top: 5rpx;
  color: #9a8876;
  font-size: 21rpx;
}

.item-qty {
  display: block;
  margin-top: 5rpx;
  color: #a2917f;
  font-size: 21rpx;
}

.item-total {
  align-self: center;
  color: #2b2118;
  font-size: 26rpx;
  font-weight: 700;
}

.total-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 20rpx;
  margin-top: 8rpx;
  color: #6f5b49;
  font-size: 24rpx;
  border-top: 1rpx dashed #e8ddcf;
}

.total-amount {
  color: #2b2118;
  font-size: 34rpx;
  font-weight: 700;
}

.remark {
  display: block;
  padding: 14rpx 0 0;
  color: #9a8876;
  font-size: 22rpx;
  line-height: 1.5;
}

.error-card {
  margin: 20rpx 24rpx 0;
  padding: 22rpx 26rpx;
  color: #b64b3c;
  font-size: 23rpx;
  background: #fff6f1;
  border: 1rpx solid #f0d3c8;
  border-radius: 22rpx;
}

.actions {
  display: flex;
  gap: 12rpx;
  padding: 28rpx 24rpx 0;
}

.action-secondary,
.action-primary {
  flex: 1;
  padding: 20rpx 10rpx;
  font-size: 23rpx;
  font-weight: 700;
  text-align: center;
  border-radius: 999rpx;
}

.action-secondary.is-loading {
  opacity: 0.55;
}

.action-secondary {
  color: #6f4e37;
  background: #fffdf9;
  border: 1rpx solid #e2d4c4;
}

.action-primary {
  color: #fffdf9;
  background: #2b2118;
}
</style>
