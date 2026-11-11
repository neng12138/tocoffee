<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchDashboard } from '../../api/dashboard'
import { getErrorMessage } from '../../api/errors'
import { formatCents } from '../../utils/money'
import { formatDateTime, todayShanghai } from '../../utils/datetime'
import type { DashboardRecentOrder, DashboardSummary } from '../../types/dashboard'
import type { AdminOrderStatus } from '../../types/order'

type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

const STATUS_META: Record<AdminOrderStatus, { label: string; type: TagType }> = {
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

const POLL_INTERVAL = 10_000

const selectedDate = ref(todayShanghai())
const data = ref<DashboardSummary | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')

let pollTimer: ReturnType<typeof setInterval> | undefined

const isToday = computed(() => selectedDate.value === todayShanghai())

function money(cents: number): string {
  if (cents < 0) {
    return `-¥${(Math.abs(cents) / 100).toFixed(2)}`
  }
  return formatCents(cents)
}

function averageText(): string {
  return data.value?.averageOrderCents == null ? '—' : money(data.value.averageOrderCents)
}

function statusMeta(status: AdminOrderStatus) {
  return STATUS_META[status]
}

function asRecent(row: unknown): DashboardRecentOrder {
  return row as DashboardRecentOrder
}

async function load(silent = false) {
  if (loading.value || refreshing.value) return

  if (silent) {
    refreshing.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    data.value = await fetchDashboard(selectedDate.value)
  } catch (err) {
    if (!silent) {
      error.value = getErrorMessage(err, '读取工作台数据失败，请确认 API 已启动')
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

watch(selectedDate, () => {
  void load()
})

onMounted(() => {
  void load()
  pollTimer = setInterval(() => {
    if (isToday.value) {
      void load(true)
    }
  }, POLL_INTERVAL)
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-toolbar">
      <div>
        <h2>今日经营</h2>
        <p class="muted">数字按支付时间统计，退款按退款日冲减；当前待接单/待取餐不受日期限制。</p>
      </div>
      <div class="toolbar-actions">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :editable="false"
          aria-label="统计日期"
        />
        <el-button :loading="loading" @click="load()">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

    <div v-if="data" v-loading="loading" class="stat-grid">
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">
          <el-tooltip content="当日支付成功的订单实付金额，减去当日完成的退款" placement="top">
            <span>营业额</span>
          </el-tooltip>
        </div>
        <div class="stat-value">{{ money(data.revenueCents) }}</div>
        <div class="stat-hint">{{ data.date }}</div>
      </el-card>

      <el-card shadow="never" class="stat-card">
        <div class="stat-label">
          <el-tooltip content="当日支付成功的订单数，包含未取餐（NO_SHOW），不包含未支付/已取消" placement="top">
            <span>订单数</span>
          </el-tooltip>
        </div>
        <div class="stat-value">{{ data.orderCount }}</div>
        <div class="stat-hint">笔已支付订单</div>
      </el-card>

      <el-card shadow="never" class="stat-card">
        <div class="stat-label">
          <el-tooltip content="营业额 ÷ 订单数，四舍五入到分；无订单显示 —" placement="top">
            <span>客单价</span>
          </el-tooltip>
        </div>
        <div class="stat-value">{{ averageText() }}</div>
        <div class="stat-hint">按净营业额计算</div>
      </el-card>

      <el-card shadow="never" class="stat-card stat-card-current">
        <div class="stat-label">当前待处理</div>
        <div class="pending-row">
          <div>
            <div class="stat-value">{{ data.pendingAcceptCount }}</div>
            <div class="stat-hint">待接单</div>
          </div>
          <div class="pending-divider" />
          <div>
            <div class="stat-value">{{ data.pendingPickupCount }}</div>
            <div class="stat-hint">待取餐</div>
          </div>
        </div>
        <div class="stat-hint">实时单量，不受统计日限制</div>
      </el-card>
    </div>

    <el-card v-if="data" shadow="never" class="recent-card">
      <template #header>
        <div class="recent-header">
          <span>最近订单</span>
          <div class="recent-actions">
            <span v-if="refreshing" class="muted">同步中…</span>
            <RouterLink to="/orders">
              <el-button link type="primary">打开订单看板</el-button>
            </RouterLink>
          </div>
        </div>
      </template>

      <el-table :data="data.recentOrders" empty-text="今天还没有已支付订单">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatDateTime(asRecent(row).createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column label="取餐码" width="100">
          <template #default="{ row }">
            <span class="pickup-code">{{ asRecent(row).pickupCode ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            {{ asRecent(row).pickupTimeType === 'SCHEDULED' ? '预约' : '立即' }}
          </template>
        </el-table-column>
        <el-table-column label="实付" width="110">
          <template #default="{ row }">{{ money(asRecent(row).paidCents) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusMeta(asRecent(row).status).type" effect="plain">
              {{ statusMeta(asRecent(row).status).label }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div v-if="!data && !loading && !error" class="empty-state">
      <el-empty description="暂无工作台数据" />
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.dashboard-toolbar h2 {
  margin: 0 0 6px;
  font-size: 24px;
}

.dashboard-toolbar p {
  margin: 0;
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  min-height: 130px;
}

.stat-label {
  color: var(--tc-muted);
  font-size: 13px;
}

.stat-value {
  margin-top: 14px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-hint {
  margin-top: 8px;
  color: var(--tc-muted);
  font-size: 12px;
}

.pending-row {
  display: flex;
  align-items: flex-end;
  gap: 22px;
  margin-top: 14px;
}

.pending-divider {
  width: 1px;
  height: 52px;
  background: var(--tc-border);
}

.recent-card {
  margin-top: 2px;
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.pickup-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 600;
}

.empty-state {
  padding: 32px 0;
}

@media (max-width: 1180px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
