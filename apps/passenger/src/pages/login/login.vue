<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ApiClientError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const phone = ref('')
const code = ref('')
const sending = ref(false)
const countdown = ref(0)
const hint = ref('')
const error = ref('')
const redirect = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(() => /^1[3-9]\d{9}$/.test(phone.value) && /^\d{6}$/.test(code.value))

onLoad((query) => {
  redirect.value = typeof query?.redirect === 'string' ? decodeURIComponent(query.redirect) : ''
})

onShow(() => {
  if (auth.isLoggedIn) goNext()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function startCountdown(seconds: number): void {
  countdown.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function sendCode(): Promise<void> {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    error.value = '请先输入正确的手机号'
    return
  }
  sending.value = true
  error.value = ''
  try {
    const result = await auth.requestCode(phone.value)
    hint.value = result.devCode
      ? `开发模式验证码：${result.devCode}（已自动填入）`
      : '验证码已发送，5 分钟内有效'
    if (result.devCode) code.value = result.devCode
    startCountdown(60)
  } catch (err) {
    error.value = err instanceof ApiClientError ? err.message : '验证码发送失败，请稍后再试'
  } finally {
    sending.value = false
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value || auth.loading) return
  error.value = ''
  try {
    await auth.login(phone.value, code.value)
    goNext()
  } catch (err) {
    error.value = err instanceof ApiClientError ? err.message : '登录失败，请稍后再试'
  }
}

function goNext(): void {
  const target =
    redirect.value && redirect.value.startsWith('/pages/') && !redirect.value.startsWith('/pages/login/')
      ? redirect.value
      : '/pages/index/index'
  uni.redirectTo({
    url: target,
    fail: () => {
      uni.reLaunch({ url: '/pages/index/index' })
    },
  })
}
</script>

<template>
  <view class="login-page">
    <view class="login-hero">
      <image class="logo" src="/static/logo.png" mode="widthFix" />
      <text class="eyebrow">TOCOFFEE · MEMBER</text>
      <text class="title">登录后继续点单</text>
      <text class="subtitle">手机号验证码登录，未注册会自动创建账号。</text>
    </view>

    <view class="login-card">
      <view class="field">
        <text class="field-label">手机号</text>
        <input
          v-model="phone"
          class="field-input"
          type="number"
          maxlength="11"
          placeholder="请输入 11 位手机号"
          placeholder-class="field-placeholder"
        />
      </view>

      <view class="field">
        <text class="field-label">验证码</text>
        <view class="code-row">
          <input
            v-model="code"
            class="field-input code-input"
            type="number"
            maxlength="6"
            placeholder="6 位验证码"
            placeholder-class="field-placeholder"
          />
          <view
            class="code-btn"
            :class="{ 'is-disabled': countdown > 0 || sending }"
            @click="countdown === 0 && !sending && sendCode()"
          >
            {{ countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码' }}
          </view>
        </view>
      </view>

      <text v-if="hint" class="hint">{{ hint }}</text>
      <text v-if="error" class="error">{{ error }}</text>

      <view class="submit-btn" :class="{ 'is-disabled': !canSubmit || auth.loading }" @click="submit">
        {{ auth.loading ? '登录中…' : '登录并继续' }}
      </view>

      <view class="demo">
        <text class="demo-title">演示说明</text>
        <text class="demo-line">开发环境会返回验证码并自动填入，不需要真实短信。</text>
        <text class="demo-line">登录仅用于下单，D8 暂不接入微信授权。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 48rpx 32rpx 64rpx;
  background:
    radial-gradient(circle at 12% 8%, rgba(220, 190, 150, 0.28), transparent 34%),
    #f5f1ea;
}

.login-hero {
  padding: 24rpx 8rpx 40rpx;
}

.logo {
  width: 220rpx;
  margin-bottom: 36rpx;
}

.eyebrow {
  display: block;
  color: #9a7b5b;
  font-size: 20rpx;
  letter-spacing: 4rpx;
}

.title {
  display: block;
  margin-top: 14rpx;
  color: #2b2118;
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.subtitle {
  display: block;
  margin-top: 16rpx;
  color: #84715f;
  font-size: 26rpx;
  line-height: 1.6;
}

.login-card {
  padding: 36rpx 32rpx 30rpx;
  background: #fffdf9;
  border: 1rpx solid #eee4d8;
  border-radius: 32rpx;
  box-shadow: 0 18rpx 50rpx rgba(86, 61, 40, 0.08);
}

.field + .field {
  margin-top: 26rpx;
}

.field-label {
  display: block;
  margin-bottom: 12rpx;
  color: #6f5b49;
  font-size: 24rpx;
  font-weight: 600;
}

.field-input {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  color: #2b2118;
  font-size: 30rpx;
  background: #f8f3ec;
  border: 1rpx solid #e9ddce;
  border-radius: 18rpx;
}

.field-placeholder {
  color: #b7a795;
}

.code-row {
  display: flex;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 230rpx;
  height: 88rpx;
  color: #fffdf9;
  font-size: 24rpx;
  font-weight: 600;
  background: #6f4e37;
  border-radius: 18rpx;
}

.code-btn.is-disabled {
  color: #a99a89;
  background: #ece4d8;
}

.hint {
  display: block;
  margin-top: 20rpx;
  color: #7b6a58;
  font-size: 23rpx;
  line-height: 1.5;
}

.error {
  display: block;
  margin-top: 20rpx;
  color: #b64b3c;
  font-size: 24rpx;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92rpx;
  margin-top: 34rpx;
  color: #fffdf9;
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  background: #2b2118;
  border-radius: 999rpx;
}

.submit-btn.is-disabled {
  color: #b8aa9b;
  background: #e4d9cb;
}

.demo {
  padding-top: 28rpx;
  margin-top: 30rpx;
  border-top: 1rpx dashed #e8ddcf;
}

.demo-title {
  display: block;
  margin-bottom: 10rpx;
  color: #8d7966;
  font-size: 22rpx;
  font-weight: 600;
}

.demo-line {
  display: block;
  color: #a08d7b;
  font-size: 21rpx;
  line-height: 1.7;
}
</style>
