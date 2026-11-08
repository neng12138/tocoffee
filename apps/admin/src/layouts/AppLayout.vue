<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { getErrorMessage } from '../api/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const roleLabel = computed(() => (auth.staff?.role === 'OWNER' ? '店主' : '店员'))

onMounted(async () => {
  if (!auth.staff) {
    try {
      await auth.loadMe()
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '读取账号信息失败'))
    }
  }
})

async function logout() {
  auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="brand sidebar-brand">
        <img src="/brand/logo.png" alt="ToCoffee" class="brand-logo" />
      </div>

      <nav class="app-nav" aria-label="管理端导航">
        <RouterLink to="/" class="nav-item">工作台</RouterLink>
        <RouterLink to="/orders" class="nav-item">订单看板</RouterLink>
        <RouterLink to="/categories" class="nav-item">分类管理</RouterLink>
        <RouterLink to="/products" class="nav-item">商品管理</RouterLink>
        <RouterLink to="/specs" class="nav-item">规格管理</RouterLink>
      </nav>

      <div class="sidebar-foot">
        <span>P0 · 单店自提</span>
        <span>Day 9 · 订单看板</span>
      </div>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <div class="header-title">
          <span class="page-title">{{ route.meta.title ?? '管理端' }}</span>
          <span v-if="auth.staff" class="store-name">{{ auth.staff.store.name }}</span>
        </div>

        <div class="header-user">
          <el-tag type="success" effect="plain">开发环境</el-tag>
          <template v-if="auth.staff">
            <span class="user-name">
              {{ auth.staff.name }}
              <template v-if="auth.staff.name !== roleLabel"> · {{ roleLabel }}</template>
            </span>
            <el-button link type="primary" @click="logout">退出登录</el-button>
          </template>
        </div>
      </header>

      <section class="app-content">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style scoped>
.sidebar-brand {
  padding: 10px 12px;
  background: var(--tc-bg);
  border-radius: 10px;
}

.brand-logo {
  display: block;
  width: 100%;
  height: auto;
}

.header-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.store-name {
  color: var(--tc-muted);
  font-size: 13px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--tc-muted);
  font-size: 13px;
}

.user-name {
  color: var(--tc-text);
}
</style>
