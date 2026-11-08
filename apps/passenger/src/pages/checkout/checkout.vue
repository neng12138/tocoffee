<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ApiClientError } from '@/api/client'
import { cancelOrder, createOrder, fetchOrder, payOrder, quoteOrder } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useShopStore } from '@/stores/store'
import type { Order, PickupTimeType, Quote } from '@/types/order'
import { buildPickupSlots, formatShanghaiTime, type PickupSlot } from '@/utils/datetime'
import { formatPrice } from '@/utils/money'

const CHECKOUT_KEY = 'tocoffee.checkout.key'
const CHECKOUT_SIGNATURE_KEY = 'tocoffee.checkout.signature'
const PENDING_ORDER_KEY = 'tocoffee.checkout.pendingOrder'

const shop = useShopStore()
const cart = useCartStore()
const auth = useAuthStore()

const loading = ref(true)
const quoting = ref(false)
const submitting = ref(false)
const error = ref('')
const quote = ref<Quote | null>(null)
const pickupTimeType = ref<PickupTimeType>('ASAP')
const slots = ref<PickupSlot[]>(buildPickupSlots())
const selectedSlot = ref('')
const contactName = ref('')
const contactPhone = ref('')
const remark = ref('')
const pendingOrderId = ref('')
const pendingOrder = ref<Order | null>(null)
const idempotencyKey = ref(readOrCreateKey())
const sessionSignature = ref(readSessionSignature())
const initialized = ref(false)
let quoteRequestId = 0

const displayItems = computed(() => {
  if (quote.value) {
    return quote.value.items.map((line) => ({
      key: line.productId + line.specText,
      imageUrl: line.imageUrl || '',
      name: line.name,
      specText: line.specText,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.totalCents,
    }))
  }
  return cart.items.map((item) => ({
    key: item.key,
    imageUrl: item.imageUrl,
    name: item.productName,
    specText: item.optionNames.join(' / ') || '默认规格',
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.unitPriceCents * item.quantity,
  }))
})

const payableCents = computed(() => quote.value?.payableCents ?? cart.totalCents)
const readyLabel = computed(() => {
  if (!quote.value) return ''
  if (pickupTimeType.value === 'SCHEDULED') return `预约 ${formatShanghaiTime(quote.value.estimatedReadyAt)} 取餐`
  return `预计 ${formatShanghaiTime(quote.value.estimatedReadyAt)} 出杯`
})
const canSubmit = computed(
  () => Boolean(quote.value) && !quoting.value && !submitting.value && cart.items.length > 0,
)

onLoad(() => {
  slots.value = buildPickupSlots()
  selectedSlot.value = slots.value[0]?.iso ?? ''
  pendingOrderId.value = readPendingOrder()
})

onShow(() => {
  if (!auth.isLoggedIn) {
    redirectToLogin()
    return
  }
  if (!initialized.value) void initialize()
})

async function initialize(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await shop.load()
    if (!shop.store) throw new Error('门店信息加载失败')
    cart.hydrate(shop.store.id)
    if (!cart.items.length) {
      uni.showToast({ title: '购物车是空的', icon: 'none' })
      setTimeout(() => uni.redirectTo({ url: '/pages/menu/menu' }), 700)
      return
    }

    await auth.loadMe()
    contactName.value = auth.member?.nickname || ''
    contactPhone.value = auth.member?.phone || ''

    if (pendingOrderId.value) {
      try {
        const order = await fetchOrder(pendingOrderId.value)
        if (order.status === 'PENDING_PAYMENT') {
          pendingOrder.value = order
          pickupTimeType.value = order.pickupTimeType
        } else {
          // 上一笔已支付/已取消：重新进入结算就是新会话，不能复用它的 key。
          clearPendingOrder()
          resetCheckoutKey()
          clearSessionSignature()
        }
      } catch {
        clearPendingOrder()
        resetCheckoutKey()
        clearSessionSignature()
      }
    }

    const currentSignature = buildSessionSignature()
    if (pendingOrder.value) {
      // 旧版本没有签名，或购物车/取餐/备注已变化：不能复用旧订单，也不能复用旧 key。
      if (!sessionSignature.value || sessionSignature.value !== currentSignature) {
        clearPendingOrder()
        resetCheckoutKey()
      }
    }
    setSessionSignature(currentSignature)

    initialized.value = true
    await refreshQuote()
  } catch (err) {
    error.value = err instanceof ApiClientError ? err.message : '结算信息加载失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

function redirectToLogin(): void {
  uni.redirectTo({
    url: `/pages/login/login?redirect=${encodeURIComponent('/pages/checkout/checkout')}`,
  })
}

function readOrCreateKey(): string {
  try {
    const existing = uni.getStorageSync(CHECKOUT_KEY) as string
    if (existing) return existing
  } catch {
    // fall through
  }
  const key = `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  try {
    uni.setStorageSync(CHECKOUT_KEY, key)
  } catch {
    // storage is best effort
  }
  return key
}

function resetCheckoutKey(): void {
  try {
    uni.removeStorageSync(CHECKOUT_KEY)
  } catch {
    // ignore
  }
  idempotencyKey.value = readOrCreateKey()
}

function buildSessionSignature(): string {
  return JSON.stringify({
    items: cart.items
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionIds: [...item.optionIds].sort(),
      }))
      .sort((a, b) =>
        `${a.productId}:${a.optionIds.join(',')}`.localeCompare(
          `${b.productId}:${b.optionIds.join(',')}`,
        ),
      ),
    pickupTimeType: pickupTimeType.value,
    scheduledAt: pickupTimeType.value === 'SCHEDULED' ? selectedSlot.value : '',
    contactName: contactName.value.trim(),
    contactPhone: contactPhone.value.trim(),
    remark: remark.value.trim(),
  })
}

function readSessionSignature(): string {
  try {
    return (uni.getStorageSync(CHECKOUT_SIGNATURE_KEY) as string) || ''
  } catch {
    return ''
  }
}

function setSessionSignature(signature = buildSessionSignature()): void {
  sessionSignature.value = signature
  try {
    uni.setStorageSync(CHECKOUT_SIGNATURE_KEY, signature)
  } catch {
    // storage is best effort
  }
}

function clearSessionSignature(): void {
  sessionSignature.value = ''
  try {
    uni.removeStorageSync(CHECKOUT_SIGNATURE_KEY)
  } catch {
    // ignore
  }
}

function readPendingOrder(): string {
  try {
    return (uni.getStorageSync(PENDING_ORDER_KEY) as string) || ''
  } catch {
    return ''
  }
}

function clearPendingOrder(): void {
  pendingOrderId.value = ''
  pendingOrder.value = null
  try {
    uni.removeStorageSync(PENDING_ORDER_KEY)
  } catch {
    // ignore
  }
}

function buildQuoteInput() {
  return {
    items: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      optionIds: item.optionIds,
    })),
    pickupTimeType: pickupTimeType.value,
    ...(pickupTimeType.value === 'SCHEDULED' && selectedSlot.value
      ? { scheduledAt: selectedSlot.value }
      : {}),
  }
}

async function refreshQuote(): Promise<void> {
  if (!cart.items.length) return
  const requestId = ++quoteRequestId
  quoting.value = true
  error.value = ''
  try {
    const result = await quoteOrder(buildQuoteInput())
    if (requestId === quoteRequestId) quote.value = result
  } catch (err) {
    if (requestId !== quoteRequestId) return
    quote.value = null
    error.value = err instanceof ApiClientError ? err.message : '报价失败，请稍后再试'
  } finally {
    if (requestId === quoteRequestId) quoting.value = false
  }
}

function selectPickupType(type: PickupTimeType): void {
  if (pickupTimeType.value === type) return
  pickupTimeType.value = type
  if (type === 'SCHEDULED' && !selectedSlot.value) {
    selectedSlot.value = slots.value[0]?.iso ?? ''
  }
  void refreshQuote()
}

function selectSlot(slot: PickupSlot): void {
  pickupTimeType.value = 'SCHEDULED'
  selectedSlot.value = slot.iso
  void refreshQuote()
}

function startNewCheckoutSession(signature = buildSessionSignature()): void {
  if (pendingOrder.value) {
    const staleOrderId = pendingOrder.value.id
    clearPendingOrder()
    void cancelOrder(staleOrderId).catch(() => {
      // 取消失败也不阻塞新结算；旧单会在 15 分钟后自然过期。
    })
  }
  resetCheckoutKey()
  setSessionSignature(signature)
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  // 兜底：即使 watcher 没触发，提交前也绝不能拿旧 key 去提交新内容。
  if (buildSessionSignature() !== sessionSignature.value) {
    startNewCheckoutSession()
  }
  submitting.value = true
  error.value = ''

  try {
    let order: Order
    if (pendingOrder.value) {
      order = pendingOrder.value
    } else {
      order = await createOrder(
        {
          ...buildQuoteInput(),
          expectedTotalCents: payableCents.value,
          ...(contactName.value.trim() ? { contactName: contactName.value.trim() } : {}),
          ...(contactPhone.value.trim() ? { contactPhone: contactPhone.value.trim() } : {}),
          ...(remark.value.trim() ? { remark: remark.value.trim() } : {}),
        },
        idempotencyKey.value,
      )
      pendingOrderId.value = order.id
      pendingOrder.value = order
      uni.setStorageSync(PENDING_ORDER_KEY, order.id)
      setSessionSignature()
    }

    if (order.status === 'PENDING_PAYMENT') {
      order = await payOrder(order.id)
    }

    if (order.status !== 'PAID') {
      throw new ApiClientError('ORDER_INVALID_STATUS', '订单状态异常，请稍后重试', 409)
    }

    cart.clear()
    clearPendingOrder()
    resetCheckoutKey()
    clearSessionSignature()
    uni.redirectTo({ url: `/pages/order/result?id=${order.id}` })
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.code === 'PRICE_CHANGED') {
        const details = err.details as { quote?: Quote } | undefined
        if (details?.quote) quote.value = details.quote
        uni.showModal({
          title: '价格已更新',
          content: '菜单价格发生变化，已为你刷新报价，请确认后重新提交。',
          showCancel: false,
        })
      } else if (err.code === 'ORDER_EXPIRED' || err.code === 'ORDER_NOT_PAYABLE') {
        clearPendingOrder()
        resetCheckoutKey()
        clearSessionSignature()
        setSessionSignature()
        error.value = '上一笔待支付订单已失效，已为你重新创建结算。'
      } else if (err.statusCode === 401) {
        auth.logout()
        redirectToLogin()
      } else {
        error.value = err.message
      }
    } else {
      error.value = err instanceof Error ? err.message : '提交订单失败，请稍后再试'
    }
  } finally {
    submitting.value = false
  }
}

watch(
  [pickupTimeType, selectedSlot, contactName, contactPhone, remark],
  () => {
    if (!initialized.value || submitting.value) return
    const signature = buildSessionSignature()
    if (signature === sessionSignature.value) return

    startNewCheckoutSession(signature)
  },
)

function retry(): void {
  if (!quote.value) {
    void refreshQuote()
  } else {
    void submit()
  }
}
</script>

<template>
  <view class="checkout-page">
    <view v-if="loading" class="state-block">
      <text class="state-icon">☕</text>
      <text class="state-title">正在准备结算</text>
      <text class="state-desc">核对商品和取餐时间…</text>
    </view>

    <template v-else>
      <view class="store-card">
        <view class="store-copy">
          <text class="store-label">自提门店</text>
          <text class="store-name">{{ shop.store?.name || 'ToCoffee' }}</text>
          <text class="store-address">{{ shop.store?.address }}</text>
        </view>
        <view class="store-badge">到店自提</view>
      </view>

      <view v-if="pendingOrder" class="resume-card">
        <view>
          <text class="resume-title">有一笔待支付订单</text>
          <text class="resume-desc">订单号 {{ pendingOrder.orderNo }}，继续支付即可完成。</text>
        </view>
        <text class="resume-mark">待支付</text>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">商品</text>
          <text class="section-meta">共 {{ cart.totalQuantity }} 件</text>
        </view>
        <view v-for="item in displayItems" :key="item.key" class="order-item">
          <image v-if="item.imageUrl" class="item-image" :src="item.imageUrl" mode="aspectFill" />
          <view v-else class="item-image item-image-fallback">☕</view>
          <view class="item-copy">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.specText }}</text>
            <view class="item-bottom">
              <text class="item-price">{{ formatPrice(item.unitPriceCents) }}</text>
              <text class="item-qty">× {{ item.quantity }}</text>
            </view>
          </view>
          <text class="item-total">{{ formatPrice(item.totalCents) }}</text>
        </view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">取餐时间</text>
          <text v-if="readyLabel" class="section-accent">{{ readyLabel }}</text>
        </view>

        <view class="pickup-tabs">
          <view
            class="pickup-tab"
            :class="{ 'is-active': pickupTimeType === 'ASAP' }"
            @click="selectPickupType('ASAP')"
          >
            <text class="pickup-tab-title">立即取餐</text>
            <text class="pickup-tab-desc">现做，约 {{ shop.store?.prepMinutes ?? 8 }} 分钟</text>
          </view>
          <view
            class="pickup-tab"
            :class="{ 'is-active': pickupTimeType === 'SCHEDULED' }"
            @click="selectPickupType('SCHEDULED')"
          >
            <text class="pickup-tab-title">预约取餐</text>
            <text class="pickup-tab-desc">到店即取，不用等</text>
          </view>
        </view>

        <scroll-view v-if="pickupTimeType === 'SCHEDULED'" class="slot-scroll" scroll-x>
          <view class="slot-track">
            <view
              v-for="slot in slots"
              :key="slot.iso"
              class="slot"
              :class="{ 'is-active': selectedSlot === slot.iso }"
              @click="selectSlot(slot)"
            >
              {{ slot.label }}
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">联系信息</text>
          <text class="section-meta">用于取餐核对</text>
        </view>
        <view class="form-row">
          <text class="form-label">联系人</text>
          <input
            v-model="contactName"
            class="form-input"
            maxlength="50"
            placeholder="怎么称呼你"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-row">
          <text class="form-label">手机号</text>
          <input
            v-model="contactPhone"
            class="form-input"
            type="number"
            maxlength="11"
            placeholder="取餐通知手机号"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-row form-row-remark">
          <text class="form-label">备注</text>
          <input
            v-model="remark"
            class="form-input"
            maxlength="50"
            placeholder="少冰、不要吸管等（选填）"
            placeholder-class="form-placeholder"
          />
        </view>
      </view>

      <view class="section-card summary-card">
        <view class="summary-row">
          <text>商品小计</text>
          <text>{{ formatPrice(quote?.itemsAmountCents ?? cart.totalCents) }}</text>
        </view>
        <view v-if="quote?.discountCents" class="summary-row summary-discount">
          <text>优惠</text>
          <text>-{{ formatPrice(quote.discountCents) }}</text>
        </view>
        <view class="summary-row summary-total">
          <text>应付</text>
          <text>{{ formatPrice(payableCents) }}</text>
        </view>
        <text class="summary-note">金额以服务端报价为准，支付成功后生成取餐码。</text>
      </view>

      <view v-if="error" class="error-card">
        <text>{{ error }}</text>
        <text v-if="!quote" class="error-retry" @click="retry">重新报价</text>
      </view>

      <view class="bottom-space"></view>
    </template>

    <view v-if="!loading" class="pay-bar">
      <view class="pay-total">
        <text class="pay-label">合计</text>
        <text class="pay-amount">{{ formatPrice(payableCents) }}</text>
      </view>
      <view
        class="pay-btn"
        :class="{ 'is-disabled': !canSubmit }"
        @click="submit"
      >
        {{ submitting ? '支付中…' : quoting ? '报价中…' : pendingOrder ? '继续支付' : '提交订单并支付' }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.checkout-page {
  min-height: 100vh;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 90% 0%, rgba(214, 184, 145, 0.22), transparent 30%),
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
}

.store-card,
.section-card,
.resume-card,
.error-card {
  margin: 20rpx 24rpx 0;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 26rpx;
}

.store-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx;
}

.store-label {
  color: #a08d7b;
  font-size: 21rpx;
  letter-spacing: 2rpx;
}

.store-name {
  display: block;
  margin-top: 6rpx;
  color: #2b2118;
  font-size: 32rpx;
  font-weight: 700;
}

.store-address {
  display: block;
  margin-top: 8rpx;
  color: #8e7d6b;
  font-size: 23rpx;
}

.store-badge {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  color: #6f4e37;
  font-size: 22rpx;
  background: #f2e9dd;
  border-radius: 999rpx;
}

.resume-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 26rpx;
  background: #fff8eb;
  border-color: #efd9b5;
}

.resume-title {
  color: #6b4a2f;
  font-size: 26rpx;
  font-weight: 700;
}

.resume-desc {
  display: block;
  margin-top: 6rpx;
  color: #9a7b5b;
  font-size: 22rpx;
}

.resume-mark {
  color: #b26b2d;
  font-size: 22rpx;
  font-weight: 600;
}

.section-card {
  padding: 26rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
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

.section-accent {
  color: #6f4e37;
  font-size: 22rpx;
  font-weight: 600;
}

.order-item {
  display: flex;
  gap: 18rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f1e9de;
}

.order-item:first-of-type {
  padding-top: 0;
  border-top: none;
}

.item-image {
  flex-shrink: 0;
  width: 108rpx;
  height: 108rpx;
  border-radius: 18rpx;
  background: #f0e7da;
}

.item-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46rpx;
}

.item-copy {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  color: #2b2118;
  font-size: 27rpx;
  font-weight: 600;
}

.item-spec {
  display: block;
  margin-top: 6rpx;
  color: #9a8876;
  font-size: 21rpx;
  line-height: 1.4;
}

.item-bottom {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 10rpx;
}

.item-price {
  color: #6f4e37;
  font-size: 23rpx;
  font-weight: 600;
}

.item-qty {
  color: #a2917f;
  font-size: 22rpx;
}

.item-total {
  align-self: center;
  color: #2b2118;
  font-size: 27rpx;
  font-weight: 700;
}

.pickup-tabs {
  display: flex;
  gap: 16rpx;
}

.pickup-tab {
  flex: 1;
  padding: 20rpx;
  background: #f8f3ec;
  border: 1rpx solid #e9ddce;
  border-radius: 18rpx;
}

.pickup-tab.is-active {
  background: #f2e7d8;
  border-color: #8b6348;
}

.pickup-tab-title {
  display: block;
  color: #3a2c20;
  font-size: 26rpx;
  font-weight: 700;
}

.pickup-tab-desc {
  display: block;
  margin-top: 8rpx;
  color: #9a8876;
  font-size: 21rpx;
}

.slot-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.slot-track {
  display: flex;
  gap: 12rpx;
  padding-bottom: 4rpx;
}

.slot {
  flex-shrink: 0;
  padding: 14rpx 24rpx;
  color: #6f5b49;
  font-size: 24rpx;
  background: #f8f3ec;
  border: 1rpx solid #e9ddce;
  border-radius: 999rpx;
}

.slot.is-active {
  color: #fffdf9;
  background: #6f4e37;
  border-color: #6f4e37;
}

.form-row {
  display: flex;
  align-items: center;
  min-height: 84rpx;
  border-top: 1rpx solid #f1e9de;
}

.form-row:first-of-type {
  border-top: none;
}

.form-label {
  width: 120rpx;
  color: #6f5b49;
  font-size: 24rpx;
}

.form-input {
  flex: 1;
  height: 84rpx;
  color: #2b2118;
  font-size: 26rpx;
  text-align: right;
}

.form-placeholder {
  color: #b7a795;
}

.form-row-remark {
  border-top: 1rpx solid #f1e9de;
}

.summary-card {
  padding-bottom: 22rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
  color: #7d6b59;
  font-size: 24rpx;
}

.summary-discount {
  color: #9a6a3a;
}

.summary-total {
  padding-top: 18rpx;
  margin-top: 8rpx;
  color: #2b2118;
  font-size: 28rpx;
  font-weight: 700;
  border-top: 1rpx dashed #e8ddcf;
}

.summary-note {
  display: block;
  margin-top: 14rpx;
  color: #a08d7b;
  font-size: 21rpx;
  line-height: 1.5;
}

.error-card {
  padding: 22rpx 26rpx;
  color: #b64b3c;
  font-size: 23rpx;
  line-height: 1.5;
  background: #fff6f1;
  border-color: #f0d3c8;
}

.error-retry {
  margin-left: 12rpx;
  font-weight: 700;
  text-decoration: underline;
}

.bottom-space {
  height: 40rpx;
}

.pay-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 253, 249, 0.96);
  border-top: 1rpx solid #e9ddce;
  backdrop-filter: blur(14px);
}

.pay-total {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.pay-label {
  color: #8e7d6b;
  font-size: 22rpx;
}

.pay-amount {
  color: #2b2118;
  font-size: 38rpx;
  font-weight: 700;
}

.pay-btn {
  padding: 22rpx 46rpx;
  color: #fffdf9;
  font-size: 28rpx;
  font-weight: 700;
  background: #2b2118;
  border-radius: 999rpx;
}

.pay-btn.is-disabled {
  color: #b8aa9b;
  background: #e4d9cb;
}
</style>
