<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { getErrorMessage } from '../../api/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const form = reactive({
  username: 'owner',
  password: 'admin123',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submit() {
  const valid = formRef.value
    ? await formRef.value.validate().catch(() => false)
    : false
  if (!valid) {
    return
  }

  try {
    await auth.login(form.username.trim(), form.password)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/'
    await router.replace(redirect)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '登录失败，请检查账号密码'))
  }
}
</script>

<template>
  <div class="login-shell">
    <el-card shadow="never" class="login-card">
      <div class="brand">
        <img src="/brand/logo.png" alt="ToCoffee" class="brand-logo" />
      </div>

      <h1>管理端登录</h1>
      <p class="muted">单店自提 · 门店后台</p>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="submit"
      >
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="请输入员工账号" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </el-form-item>

        <el-button type="primary" class="login-button" :loading="auth.loading" @click="submit">
          登录
        </el-button>
      </el-form>

      <div class="demo-hint">
        <span>演示账号</span>
        <code>owner / admin123</code>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 10%, rgba(192, 138, 90, 0.18), transparent 42%),
    var(--tc-bg);
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
  margin: 0 0 6px;
  font-size: 24px;
}

.muted {
  margin: 0 0 20px;
  color: var(--tc-muted);
}

.login-button {
  width: 100%;
  margin-top: 4px;
}

.demo-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  color: var(--tc-muted);
  font-size: 13px;
  border-top: 1px solid var(--tc-border);
}

.demo-hint code {
  padding: 4px 8px;
  color: var(--tc-text);
  background: var(--tc-bg);
  border-radius: 6px;
}
</style>
