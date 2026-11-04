<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // 购物车在进入页面后按门店 hydrate，登录态在 D5 接入。
})
</script>

<style>
page {
  color: #2b2118;
  background: #f5f1ea;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}

view,
text,
image,
scroll-view,
button {
  box-sizing: border-box;
}

button::after {
  border: none;
}
</style>
