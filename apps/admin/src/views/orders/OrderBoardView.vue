<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  acceptOrder,
  completeOrder,
  fetchOrder,
  fetchOrders,
  readyOrder,
  rejectOrder,
} from '../../api/orders'
import { getErrorMessage } from '../../api/errors'
import { formatCents } from '../../utils/money'
import { formatClock, formatDateTime, todayShanghai } from '../../utils/datetime'
import type {
  AdminOrder,
  AdminOrderListParams,
  AdminOrderStatus,
  AdminOrderTab,
} from '../../types/order'

type OrderAction = 'accept' | 'ready' | 'complete'
type StatusTagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

interface StatusMeta {
  label: string
  type: StatusTagType
}

const STATUS_META: Record<AdminOrderStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: '待支付', type: 'info' },
  PAID: { label: '待接单', type: 'warning' },
  ACCEPTED: { label: '制作中', type: 'primary' },
  READY: { label: '待取餐', type: 'success' },
  COMPLETED: { label: '已完成', type: 'info' },
  NO_SHOW: { label: '未取餐', type: 'danger' },
  CANCELED: { label: '已取消', type: 'info' },
  REFUNDING: { label: '退款中', type: 'warning' },
  REFUNDED: { label: '已退款', type: 'danger' },
}

const SOUND_KEY = 'tocoffee.admin.sound'
const POLL_INTERVAL = 5_000

const tab = ref<AdminOrderTab>('ACTIVE')
const selectedDate = ref(todayShanghai())
const orders = ref<AdminOrder[]>([])
const counts = ref({ active: 0, scheduled: 0, all: 0 })
const loading = ref(false)
const polling = ref(false)
const soundEnabled = ref(localStorage.getItem(SOUND_KEY) === '1')
const actionLoading = ref('')
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminOrder | null>(null)

const tabs = computed(() => [
  { key: 'ACTIVE' as const, label: '进行中', count: counts.value.active },
  { key: 'SCHEDULED' as const, label: '预约', count: counts.value.scheduled },
  { key: 'ALL' as const, label: '全部', count: counts.value.all },
])

const displayOrders = computed(() => {
  const priority: Partial<Record<AdminOrderStatus, number>> = {
    PAID: 0,
    ACCEPTED: 1,
    READY: 2,
  }
  const now = Date.now()

  return [...orders.value].sort((a, b) => {
    const aFresh = isRecentlyReleased(a, now) ? 1 : 0
    const bFresh = isRecentlyReleased(b, now) ? 1 : 0
    if (aFresh !== bFresh) {
      return bFresh - aFresh
    }

    const aPriority = priority[a.status] ?? 9
    const bPriority = priority[b.status] ?? 9
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

let pollTimer: ReturnType<typeof setInterval> | undefined
let flashTimer: ReturnType<typeof setInterval> | undefined
let flashStopTimer: ReturnType<typeof setTimeout> | undefined
let audioContext: AudioContext | null = null
const seenActiveIds = new Set<string>()
let activeSeeded = false
let pollingInFlight = false

function statusMeta(status: AdminOrderStatus): StatusMeta {
  return STATUS_META[status]
}

function isReleased(order: AdminOrder): boolean {
  return order.pickupTimeType === 'ASAP' || Boolean(order.releasedAt)
}

function isUnreleased(order: AdminOrder): boolean {
  return order.pickupTimeType === 'SCHEDULED' && !order.releasedAt
}

function isRecentlyReleased(order: AdminOrder, now = Date.now()): boolean {
  if (!order.releasedAt) return false
  return now - new Date(order.releasedAt).getTime() < 5 * 60_000
}

function canReject(order: AdminOrder): boolean {
  return ['PAID', 'ACCEPTED', 'READY', 'NO_SHOW'].includes(order.status)
}

function itemCount(order: AdminOrder): number {
  return order.items.reduce((total, item) => total + item.quantity, 0)
}

function itemSummary(order: AdminOrder): string {
  if (!order.items.length) return '暂无商品明细'
  return order.items
    .map((item) => `${item.productName} ×${item.quantity}`)
    .join('、')
}

function isActionLoading(order: AdminOrder, action: string): boolean {
  return actionLoading.value === `${order.id}:${action}`
}

async function load(silent = false) {
  if (!silent) {
    loading.value = true
  }
  try {
    const params: AdminOrderListParams = {
      tab: tab.value,
      date: selectedDate.value,
      page: 1,
      pageSize: 50,
    }
    const result = await fetchOrders(params)
    counts.value = result.counts
    detectNewOrders(result.items)
    orders.value = result.items
  } catch (error) {
    if (!silent) {
      ElMessage.error(getErrorMessage(error, '加载订单失败'))
    }
  } finally {
    loading.value = false
  }
}

function detectNewOrders(items: AdminOrder[]) {
  if (tab.value !== 'ACTIVE') return

  const paidIds = items
    .filter((order) => order.status === 'PAID' && isReleased(order))
    .map((order) => order.id)

  if (!activeSeeded) {
    paidIds.forEach((id) => seenActiveIds.add(id))
    activeSeeded = true
    return
  }

  const fresh = paidIds.filter((id) => !seenActiveIds.has(id))
  paidIds.forEach((id) => seenActiveIds.add(id))
  if (fresh.length > 0) {
    notifyNewOrder()
  }
}

function notifyNewOrder() {
  void playBeep()
  startTitleFlash()
  ElMessage({
    type: 'success',
    message: '有新的待接单，请及时处理',
    duration: 3000,
  })
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

async function playBeep() {
  if (!soundEnabled.value) return
  const context = ensureAudioContext()
  if (context.state === 'suspended') {
    await context.resume()
  }
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + 0.35,
  )
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.38)
}

function onSoundChange() {
  if (!soundEnabled.value) {
    localStorage.removeItem(SOUND_KEY)
    stopTitleFlash()
    return
  }

  try {
    ensureAudioContext()
    localStorage.setItem(SOUND_KEY, '1')
    void playBeep()
    ElMessage.success('新单提示音已开启')
  } catch {
    soundEnabled.value = false
    localStorage.removeItem(SOUND_KEY)
    ElMessage.error('浏览器不允许播放提示音，请检查权限')
  }
}

function startTitleFlash() {
  if (flashTimer) return
  let bright = false
  flashTimer = setInterval(() => {
    document.title = bright ? '🔔 新订单 · ToCoffee' : '订单看板 · ToCoffee'
    bright = !bright
  }, 800)
  flashStopTimer = setTimeout(stopTitleFlash, 10_000)
}

function stopTitleFlash() {
  if (flashTimer) {
    clearInterval(flashTimer)
    flashTimer = undefined
  }
  if (flashStopTimer) {
    clearTimeout(flashStopTimer)
    flashStopTimer = undefined
  }
  document.title = '订单看板 · ToCoffee'
}

function onTabChange(name: string | number) {
  tab.value = name as AdminOrderTab
  void load()
}

function onDateChange() {
  seenActiveIds.clear()
  activeSeeded = false
  void load()
}

async function poll() {
  if (pollingInFlight) return
  pollingInFlight = true
  polling.value = true
  try {
    await load(true)
  } finally {
    pollingInFlight = false
    polling.value = false
  }
}

async function refresh() {
  seenActiveIds.clear()
  activeSeeded = false
  await load()
}

async function openDetail(order: AdminOrder) {
  detail.value = order
  detailVisible.value = true
  detailLoading.value = true
  try {
    detail.value = await fetchOrder(order.id)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载订单详情失败'))
  } finally {
    detailLoading.value = false
  }
}

async function runAction(order: AdminOrder, action: OrderAction) {
  const labels: Record<OrderAction, string> = {
    accept: '接单',
    ready: '出杯',
    complete: '确认取餐',
  }
  actionLoading.value = `${order.id}:${action}`
  try {
    const updated =
      action === 'accept'
        ? await acceptOrder(order.id)
        : action === 'ready'
          ? await readyOrder(order.id)
          : await completeOrder(order.id)

    ElMessage.success(`已${labels[action]}`)
    if (detail.value?.id === updated.id) {
      detail.value = updated
    }
    await load(true)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, `订单${labels[action]}失败`))
    await load(true)
  } finally {
    actionLoading.value = ''
  }
}

async function handleReject(order: AdminOrder) {
  try {
    const result = await ElMessageBox.prompt(
      '拒单后会立即发起 mock 退款，请填写原因',
      '拒单退款',
      {
        confirmButtonText: '确认退款',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '例如：咖啡豆用完、设备故障',
        inputValidator: (value) =>
          Boolean(value && value.trim()) || '请填写拒单原因',
      },
    )

    const reason = result.value.trim()
    if (!reason) return

    actionLoading.value = `${order.id}:reject`
    const updated = await rejectOrder(order.id, reason)
    ElMessage.success('已拒单并退款')
    if (detail.value?.id === updated.id) {
      detail.value = updated
    }
    await load(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(getErrorMessage(error, '拒单失败'))
    await load(true)
  } finally {
    actionLoading.value = ''
  }
}

function unlockAudioOnce() {
  if (!soundEnabled.value) return
  try {
    ensureAudioContext()
  } catch {
    // 用户尚未允许音频时静默失败，点击开关可重试。
  }
}

watch(selectedDate, onDateChange)

onMounted(() => {
  void load()
  pollTimer = setInterval(() => {
    void poll()
  }, POLL_INTERVAL)
  window.addEventListener('focus', stopTitleFlash)
  window.addEventListener('pointerdown', unlockAudioOnce, {
    once: true,
    capture: true,
  })
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  stopTitleFlash()
  window.removeEventListener('focus', stopTitleFlash)
  void audioContext?.close()
})
</script>

<template>
  <el-card class="page-card" shadow="never">
    <div class="page-card-header">
      <div>
        <h2>订单看板</h2>
        <p class="muted">
          每 5 秒刷新 · 预约单释放后进入进行中 · 拒单立即 mock 退款
        </p>
      </div>

      <div class="toolbar order-toolbar">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          class="date-picker"
        />
        <el-switch
          v-model="soundEnabled"
          active-text="新单提示音"
          @change="onSoundChange"
        />
        <el-button :loading="loading" @click="refresh">刷新</el-button>
        <span v-if="polling" class="polling-dot" title="轮询中">●</span>
      </div>
    </div>

    <el-tabs v-model="tab" class="order-tabs" @tab-change="onTabChange">
      <el-tab-pane
        v-for="item in tabs"
        :key="item.key"
        :name="item.key"
        :label="`${item.label} ${item.count}`"
      />
    </el-tabs>

    <el-skeleton v-if="loading && !orders.length" :rows="5" animated />

    <el-empty
      v-else-if="!displayOrders.length"
      description="这一天还没有订单"
    />

    <div v-else class="order-list">
      <article
        v-for="order in displayOrders"
        :key="order.id"
        class="order-card"
        :class="{ 'is-fresh': isRecentlyReleased(order) }"
        @click="openDetail(order)"
      >
        <div class="order-main">
          <div class="pickup">
            <span class="pickup-code">{{ order.pickupCode || '—' }}</span>
            <span class="pickup-type">
              {{
                order.pickupTimeType === 'ASAP'
                  ? '立即取餐'
                  : `预约 ${formatClock(order.scheduledAt)}`
              }}
            </span>
          </div>

          <div class="order-info">
            <div class="order-title-row">
              <strong>{{ order.orderNo }}</strong>
              <el-tag :type="statusMeta(order.status).type" effect="dark">
                {{ statusMeta(order.status).label }}
              </el-tag>
              <el-tag
                v-if="isUnreleased(order)"
                type="info"
                effect="plain"
              >
                {{ formatClock(order.releaseAt) }} 释放
              </el-tag>
              <el-tag
                v-if="isRecentlyReleased(order)"
                type="success"
                effect="plain"
              >
                刚释放
              </el-tag>
            </div>

            <div class="order-customer">
              {{ order.contactName || '未留姓名' }}
              <span v-if="order.contactPhone">· {{ order.contactPhone }}</span>
              <span class="dot">·</span>
              {{ itemCount(order) }} 件
            </div>

            <div class="order-items">{{ itemSummary(order) }}</div>

            <div class="order-meta">
              <span>实付 {{ formatCents(order.paidCents) }}</span>
              <span v-if="order.remark" class="order-remark">
                备注：{{ order.remark }}
              </span>
              <span v-if="order.estimatedReadyAt">
                预计 {{ formatClock(order.estimatedReadyAt) }} 出杯
              </span>
            </div>
          </div>

          <div class="order-actions" @click.stop>
            <el-button
              v-if="order.status === 'PAID' && isReleased(order)"
              type="primary"
              :loading="isActionLoading(order, 'accept')"
              @click="runAction(order, 'accept')"
            >
              接单
            </el-button>
            <el-button
              v-else-if="order.status === 'ACCEPTED'"
              type="primary"
              :loading="isActionLoading(order, 'ready')"
              @click="runAction(order, 'ready')"
            >
              出杯
            </el-button>
            <el-button
              v-else-if="order.status === 'READY'"
              type="success"
              :loading="isActionLoading(order, 'complete')"
              @click="runAction(order, 'complete')"
            >
              确认取餐
            </el-button>
            <el-button
              v-if="canReject(order)"
              type="danger"
              plain
              :loading="isActionLoading(order, 'reject')"
              @click="handleReject(order)"
            >
              拒单退款
            </el-button>
            <span v-if="order.status === 'PAID' && !isReleased(order)" class="waiting">
              等待释放
            </span>
          </div>
        </div>

        <div class="order-foot">
          <span>下单 {{ formatClock(order.createdAt) }}</span>
          <span>营业日 {{ order.businessDate }}</span>
          <span v-if="order.paidAt">支付 {{ formatClock(order.paidAt) }}</span>
        </div>
      </article>
    </div>
  </el-card>

  <el-drawer
    v-model="detailVisible"
    title="订单详情"
    size="480px"
    @closed="detail = null"
  >
    <div v-loading="detailLoading" class="detail-body">
      <template v-if="detail">
        <div class="detail-head">
          <span class="detail-code">{{ detail.pickupCode || '—' }}</span>
          <el-tag :type="statusMeta(detail.status).type" effect="dark">
            {{ statusMeta(detail.status).label }}
          </el-tag>
        </div>

        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="订单号">
            {{ detail.orderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="顾客">
            {{ detail.contactName || '未留姓名' }}
            {{ detail.contactPhone ? ` / ${detail.contactPhone}` : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="取餐">
            {{
              detail.pickupTimeType === 'ASAP'
                ? '立即取餐'
                : `预约 ${formatDateTime(detail.scheduledAt)}`
            }}
          </el-descriptions-item>
          <el-descriptions-item label="支付时间">
            {{ formatDateTime(detail.paidAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="预计出杯">
            {{ formatDateTime(detail.estimatedReadyAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="实付">
            {{ formatCents(detail.paidCents) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.remark" label="备注">
            {{ detail.remark }}
          </el-descriptions-item>
        </el-descriptions>

        <h4>商品</h4>
        <div class="detail-items">
          <div
            v-for="item in detail.items"
            :key="item.id"
            class="detail-item"
          >
            <div>
              <strong>{{ item.productName }}</strong>
              <div class="muted">{{ item.specText }}</div>
            </div>
            <div class="detail-item-price">
              ×{{ item.quantity }} · {{ formatCents(item.totalCents) }}
            </div>
          </div>
        </div>

        <h4>状态时间线</h4>
        <el-timeline>
          <el-timeline-item
            v-for="event in detail.events"
            :key="event.id"
            :timestamp="formatDateTime(event.createdAt)"
          >
            {{ event.note || `${event.fromStatus ?? '—'} → ${event.toStatus}` }}
          </el-timeline-item>
        </el-timeline>

        <div class="detail-actions">
          <el-button
            v-if="detail.status === 'PAID' && isReleased(detail)"
            type="primary"
            :loading="isActionLoading(detail, 'accept')"
            @click="runAction(detail, 'accept')"
          >
            接单
          </el-button>
          <el-button
            v-if="detail.status === 'ACCEPTED'"
            type="primary"
            :loading="isActionLoading(detail, 'ready')"
            @click="runAction(detail, 'ready')"
          >
            出杯
          </el-button>
          <el-button
            v-if="detail.status === 'READY'"
            type="success"
            :loading="isActionLoading(detail, 'complete')"
            @click="runAction(detail, 'complete')"
          >
            确认取餐
          </el-button>
          <el-button
            v-if="canReject(detail)"
            type="danger"
            plain
            :loading="isActionLoading(detail, 'reject')"
            @click="handleReject(detail)"
          >
            拒单退款
          </el-button>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.order-toolbar {
  margin-bottom: 0;
}

.date-picker {
  width: 150px;
}

.polling-dot {
  color: var(--tc-accent);
  font-size: 10px;
}

.order-tabs {
  margin-top: 16px;
}

.order-list {
  display: grid;
  gap: 12px;
}

.order-card {
  padding: 14px 16px 10px;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--tc-border);
  border-radius: 10px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.order-card:hover {
  border-color: var(--tc-accent);
  box-shadow: 0 6px 18px rgb(111 78 55 / 8%);
}

.order-card.is-fresh {
  border-color: var(--tc-accent);
  box-shadow: 0 0 0 3px rgb(192 138 90 / 12%);
}

.order-main {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}

.pickup {
  display: grid;
  gap: 3px;
  text-align: center;
}

.pickup-code {
  color: var(--tc-primary);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.pickup-type {
  color: var(--tc-muted);
  font-size: 12px;
}

.order-info {
  min-width: 0;
}

.order-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.order-title-row strong {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.order-customer {
  margin-top: 7px;
  color: var(--tc-text);
  font-size: 13px;
}

.order-customer .dot {
  margin: 0 6px;
  color: var(--tc-border);
}

.order-items {
  overflow: hidden;
  margin-top: 4px;
  color: var(--tc-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 7px;
  color: var(--tc-muted);
  font-size: 12px;
}

.order-remark {
  max-width: 380px;
  overflow: hidden;
  color: var(--tc-accent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 250px;
}

.order-actions .el-button + .el-button {
  margin-left: 0;
}

.waiting {
  align-self: center;
  color: var(--tc-muted);
  font-size: 12px;
}

.order-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding-top: 8px;
  margin-top: 10px;
  color: #9b8d80;
  font-size: 11px;
  border-top: 1px dashed var(--tc-border);
}

.detail-body {
  min-height: 160px;
  padding: 0 4px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-code {
  color: var(--tc-primary);
  font-size: 34px;
  font-weight: 800;
}

.detail-body h4 {
  margin: 22px 0 10px;
  font-size: 14px;
}

.detail-items {
  overflow: hidden;
  border: 1px solid var(--tc-border);
  border-radius: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  font-size: 13px;
}

.detail-item + .detail-item {
  border-top: 1px solid var(--tc-border);
}

.detail-item-price {
  flex-shrink: 0;
  color: var(--tc-muted);
  font-size: 12px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 20px;
  margin-top: 22px;
  border-top: 1px solid var(--tc-border);
}

@media (max-width: 900px) {
  .order-main {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .pickup-code {
    font-size: 24px;
  }

  .order-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
