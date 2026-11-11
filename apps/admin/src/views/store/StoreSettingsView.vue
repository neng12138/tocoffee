<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAdminStore, updateAdminStore } from '../../api/store'
import { getErrorMessage } from '../../api/errors'
import type { AdminStore, StoreBusinessHour, UpdateStoreInput } from '../../types/store'

interface DayRow {
  day: number
  label: string
  enabled: boolean
  open: string
  close: string
}

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const current = ref<AdminStore | null>(null)

const form = reactive({
  name: '',
  address: '',
  phone: '',
  isAcceptingOrders: true,
  prepMinutes: 8,
  perOrderMinutes: 2,
  pickupNotice: '',
  pickupCodePrefix: 'A',
})

const days = ref<DayRow[]>(
  DAY_LABELS.map((label, index) => ({
    day: index + 1,
    label,
    enabled: true,
    open: '08:00',
    close: '20:00',
  })),
)

const isOpen = computed(() => current.value?.isOpen ?? false)
const todayHours = computed(() => current.value?.todayHours ?? null)

function hoursPayload(): StoreBusinessHour[] {
  return days.value
    .filter((row) => row.enabled)
    .map((row) => ({ day: row.day, open: row.open, close: row.close }))
}

function applyStore(store: AdminStore) {
  current.value = store
  form.name = store.name
  form.address = store.address
  form.phone = store.phone ?? ''
  form.isAcceptingOrders = store.isAcceptingOrders
  form.prepMinutes = store.prepMinutes
  form.perOrderMinutes = store.perOrderMinutes
  form.pickupNotice = store.pickupNotice ?? ''
  form.pickupCodePrefix = store.pickupCodePrefix

  days.value = DAY_LABELS.map((label, index) => {
    const day = index + 1
    const existing = store.businessHours.find((item) => item.day === day)
    return {
      day,
      label,
      enabled: Boolean(existing),
      open: existing?.open ?? '08:00',
      close: existing?.close ?? '20:00',
    }
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    applyStore(await fetchAdminStore())
  } catch (err) {
    error.value = getErrorMessage(err, '读取门店设置失败')
  } finally {
    loading.value = false
  }
}

function validate(): string {
  if (!form.name.trim()) return '请填写门店名称'
  if (!form.address.trim()) return '请填写门店地址'
  if (form.phone && !/^[0-9+\-\s]{5,32}$/.test(form.phone.trim())) {
    return '门店电话格式不正确'
  }
  if (!Number.isInteger(form.prepMinutes) || form.prepMinutes < 1 || form.prepMinutes > 120) {
    return '制作时长需为 1–120 分钟'
  }
  if (
    !Number.isInteger(form.perOrderMinutes) ||
    form.perOrderMinutes < 0 ||
    form.perOrderMinutes > 60
  ) {
    return '每单间隔需为 0–60 分钟'
  }
  if (form.pickupNotice.length > 500) return '取餐提示不能超过 500 字'
  if (!/^[A-Za-z0-9]{1,4}$/.test(form.pickupCodePrefix)) {
    return '取餐码前缀只能是 1–4 位字母或数字'
  }

  for (const row of days.value) {
    if (!row.enabled) continue
    if (row.open >= row.close) {
      return `${row.label}的打烊时间必须晚于开门时间`
    }
  }

  return ''
}

async function save() {
  const message = validate()
  if (message) {
    ElMessage.warning(message)
    return
  }

  saving.value = true
  error.value = ''
  try {
    const payload: UpdateStoreInput = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      isAcceptingOrders: form.isAcceptingOrders,
      prepMinutes: form.prepMinutes,
      perOrderMinutes: form.perOrderMinutes,
      pickupNotice: form.pickupNotice.trim(),
      pickupCodePrefix: form.pickupCodePrefix.trim().toUpperCase(),
      businessHours: hoursPayload(),
    }
    applyStore(await updateAdminStore(payload))
    ElMessage.success('门店设置已保存')
  } catch (err) {
    error.value = getErrorMessage(err, '保存门店设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div v-loading="loading" class="store-settings">
    <div class="page-heading">
      <div>
        <h2>门店设置</h2>
        <p class="muted">保存后顾客端下次请求立即生效；休息日直接关闭该天营业时间。</p>
      </div>
      <div class="status-line">
        <el-tag :type="isOpen ? 'success' : 'info'" effect="plain">
          {{ isOpen ? '营业中' : '休息中' }}
        </el-tag>
        <span v-if="todayHours" class="muted">
          今日 {{ todayHours.open }}–{{ todayHours.close }}
        </span>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

    <el-form label-position="top" class="settings-form" @submit.prevent>
      <el-card shadow="never">
        <template #header><span>基础信息</span></template>
        <div class="form-grid">
          <el-form-item label="门店名称" required>
            <el-input v-model="form.name" maxlength="80" show-word-limit />
          </el-form-item>
          <el-form-item label="门店电话">
            <el-input v-model="form.phone" maxlength="32" placeholder="020-88886666" />
          </el-form-item>
          <el-form-item label="门店地址" required class="span-2">
            <el-input v-model="form.address" maxlength="255" show-word-limit />
          </el-form-item>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-title-row">
            <span>接单与制作</span>
            <el-switch
              v-model="form.isAcceptingOrders"
              active-text="接受新订单"
              inactive-text="暂停接单"
            />
          </div>
        </template>
        <div class="form-grid">
          <el-form-item label="单杯制作时长（分钟）" required>
            <el-input-number v-model="form.prepMinutes" :min="1" :max="120" />
          </el-form-item>
          <el-form-item label="每单占用间隔（分钟）" required>
            <el-input-number v-model="form.perOrderMinutes" :min="0" :max="60" />
          </el-form-item>
          <el-form-item label="取餐码前缀" required>
            <el-input v-model="form.pickupCodePrefix" maxlength="4" class="prefix-input" />
          </el-form-item>
          <el-form-item label="取餐提示" class="span-2">
            <el-input
              v-model="form.pickupNotice"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-title-row">
            <span>营业时间</span>
            <span class="muted">P0 不支持跨天营业，打烊需晚于开门</span>
          </div>
        </template>

        <div class="hours-list">
          <div v-for="row in days" :key="row.day" class="hours-row">
            <el-switch v-model="row.enabled" />
            <span class="day-label">{{ row.label }}</span>
            <el-time-select
              v-model="row.open"
              start="06:00"
              step="00:30"
              end="23:30"
              :disabled="!row.enabled"
              placeholder="开门"
            />
            <span class="time-sep">至</span>
            <el-time-select
              v-model="row.close"
              start="06:30"
              step="00:30"
              end="23:59"
              :disabled="!row.enabled"
              placeholder="打烊"
            />
            <span v-if="!row.enabled" class="muted rest-tip">休息</span>
          </div>
        </div>
      </el-card>

      <div class="save-row">
        <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
        <el-button :disabled="saving" @click="load">重置</el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.store-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 980px;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.page-heading h2 {
  margin: 0 0 6px;
  font-size: 24px;
}

.page-heading p {
  margin: 0;
  font-size: 13px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 20px;
}

.span-2 {
  grid-column: span 2;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.prefix-input {
  max-width: 120px;
}

.hours-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hours-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.day-label {
  width: 44px;
  font-size: 13px;
}

.time-sep {
  color: var(--tc-muted);
  font-size: 12px;
}

.rest-tip {
  font-size: 12px;
}

.save-row {
  display: flex;
  gap: 10px;
  padding-bottom: 8px;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }

  .hours-row {
    flex-wrap: wrap;
  }
}
</style>
