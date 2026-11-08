<script setup lang="ts">
import { ref } from 'vue'
import client from '../../api/client'

const health = ref<string>('')
const checking = ref(false)
const error = ref<string>('')

async function checkHealth() {
  checking.value = true
  error.value = ''
  health.value = ''

  try {
    const { data } = await client.get('/health')
    health.value = JSON.stringify(data, null, 2)
  } catch {
    error.value = 'API 未启动或无法访问，请先运行 apps/api 与 Docker PostgreSQL。'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <el-card shadow="never" class="placeholder-card">
    <template #header>
      <div class="card-header">
        <span>门店工作台</span>
        <el-tag type="success" effect="plain">Day 9</el-tag>
      </div>
    </template>

    <h2>ToCoffee 管理端</h2>
    <p class="muted">
      分类、商品、规格和图片上传已接入；订单看板支持接单、出杯、确认取餐与拒单退款。
    </p>

    <div class="quick-links">
      <RouterLink to="/orders">
        <el-button type="primary">订单看板</el-button>
      </RouterLink>
      <RouterLink to="/categories">
        <el-button plain>分类管理</el-button>
      </RouterLink>
      <RouterLink to="/products">
        <el-button plain>商品管理</el-button>
      </RouterLink>
      <RouterLink to="/specs">
        <el-button plain>规格管理</el-button>
      </RouterLink>
    </div>

    <div class="health-row">
      <el-button type="primary" :loading="checking" @click="checkHealth">
        检查 API 健康
      </el-button>
      <span class="muted">GET /api/health</span>
    </div>

    <pre v-if="health" class="health-output">{{ health }}</pre>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" show-icon />
  </el-card>
</template>

<style scoped>
.placeholder-card {
  max-width: 760px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h2 {
  margin: 0 0 12px;
  font-size: 24px;
}

.muted {
  color: var(--tc-muted);
}

.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0 4px;
}

.health-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 12px;
}

.health-output {
  margin: 0;
  padding: 16px;
  overflow: auto;
  color: var(--tc-text);
  background: var(--tc-bg);
  border: 1px solid var(--tc-border);
  border-radius: 8px;
}
</style>
