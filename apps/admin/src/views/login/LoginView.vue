<template>
  <div class="login-shell">
    <el-card shadow="never" class="login-card">
      <div class="brand">
        <img src="/brand/logo.png" alt="ToCoffee" class="brand-logo" />
      </div>
      <h1>管理端登录</h1>
      <p class="muted">登录表单在 Day 5 接入，演示账号 owner / admin123。</p>
      <RouterLink to="/">
        <el-button type="primary" plain>先进入工作台占位页</el-button>
      </RouterLink>
    </el-card>
  </div>
</template>

<style scoped>
.login-shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: var(--tc-bg);
}

.login-card {
  width: min(420px, 100%);
}

.brand {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.brand-logo {
  display: block;
  width: 220px;
  max-width: 100%;
  height: auto;
}

h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.muted {
  margin: 0 0 24px;
  color: var(--tc-muted);
}
</style>
