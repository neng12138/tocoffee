<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="brand sidebar-brand">
        <img src="/brand/logo.png" alt="ToCoffee" class="brand-logo" />
      </div>

      <nav class="app-nav" aria-label="管理端导航">
        <RouterLink to="/" class="nav-item">工作台</RouterLink>
      </nav>

      <div class="sidebar-foot">
        <span>P0 · 单店自提</span>
        <span>Day 3 · API 已就绪</span>
      </div>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <span class="page-title">{{ route.meta.title ?? '管理端' }}</span>
        <el-tag type="success" effect="plain">开发环境</el-tag>
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
</style>
