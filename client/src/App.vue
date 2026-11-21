<template>
  <!-- 全局消息提示组件（置于 router-view 之前，确保 window.$snackbar/$dialog 在子组件请求前就绪） -->
  <AppSnackbar />

  <!-- 全局对话框组件 -->
  <AppDialog />

  <!-- 路由级 loading：必须挂在路由组件之外，导航 confirm 前它还没创建 -->
  <AppRouteLoading />

  <router-view></router-view>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import AppSnackbar from './components/AppSnackbar.vue'
import AppDialog from './components/AppDialog.vue'
import AppRouteLoading from './components/AppRouteLoading.vue'
import { useConfigStore } from './store/config.js'
import { useUserStore } from './store/user.js'
import { useWebSocket } from '@/server/useWebSocket'
import websocketManager from '@/server/websocketManager'
import { loadClientConfig } from './router'

// ============================================================
// 数据
// ============================================================
const configStore = useConfigStore()
const userStore = useUserStore()

// 初始化 WebSocket
const { initWebSocketListener } = useWebSocket()

// 代码块滚动条开关：同步到根元素，供 markdown-preview.scss 隐藏代码块滚动条
watch(
  () => configStore.isCodeBlockScrollbarEnabled,
  (enabled) => document.documentElement.classList.toggle('code-block-scrollbar-hidden', !enabled),
  { immediate: true }
)

// ============================================================
// 生命周期
// ============================================================
onMounted(async () => {
  // 等待配置加载完成，再判断 websocket 开关（避免使用默认值 true）
  await loadClientConfig()

  // cookie 模式：本地有 user 缓存时请求一次 userDetailInfo 校验登录态（未登录网友零请求）
  await userStore.verifyLogin()

  if (configStore.getWebsocketEnabled() && configStore.getWebsocketBackendEnabled()) {
    // 检查并处理强退用户点击刷新标记
    await websocketManager.checkAndHandleForceLogout()

    initWebSocketListener()
  }
})
</script>

<style scoped lang="scss"></style>
