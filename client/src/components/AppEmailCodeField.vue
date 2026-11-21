<template>
  <div>
    <!-- ===== 邮箱输入 ===== -->
    <v-text-field
      ref="emailFieldRef"
      color="primary"
      variant="outlined"
      density="compact"
      :model-value="email"
      @update:model-value="emit('update:email', $event)"
      label="邮箱"
      :placeholder="emailPlaceholder"
      :rules="emailRules"
      prepend-inner-icon="mdi-email"
      class="mb-2"
      name="email"
      :disabled="emailDisabled"
    >
    </v-text-field>

    <!-- ===== 验证码输入 + 发送按钮 ===== -->
    <v-row style="margin-bottom: -20px">
      <v-col :cols="!display.mobile.value ? 8 : 7">
        <v-text-field
          color="primary"
          variant="outlined"
          density="compact"
          :model-value="code"
          @update:model-value="emit('update:code', $event)"
          label="验证码"
          placeholder="请输入验证码"
          :rules="codeRules"
          prepend-inner-icon="mdi-email"
          class="mb-4"
          name="verifyCode"
        >
        </v-text-field>
      </v-col>
      <v-col :cols="!display.mobile.value ? 4 : 5">
        <v-btn block :disabled="countdown > 0 || isSending" @click="handleSendCode">
          <span v-if="countdown > 0">{{ countdown }}秒后重试</span>
          <span v-else>获取验证码</span>
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import { emailCodeSendApi } from '@/api/email'
import { useEmailCooldown } from '@/utils/emailCooldown'

// ============================================================
// 数据
// ============================================================

// v-model 双向绑定（经典 props + emits 写法）
const props = defineProps({
  email: {
    type: String,
    default: ''
  },
  code: {
    type: String,
    default: ''
  },
  // 禁用邮箱输入框（注销等场景：邮箱锁定为当前账号邮箱）
  emailDisabled: {
    type: Boolean,
    default: false
  },
  emailPlaceholder: {
    type: String,
    default: '请输入邮箱'
  },
  // 验证码类型：register-注册，forgot-忘记密码
  type: {
    type: String,
    default: 'register'
  }
})

const emit = defineEmits(['update:email', 'update:code'])

const display = useDisplay()

// 邮箱输入框 ref（发送前只校验邮箱这一个字段）
const emailFieldRef = ref(null)

const { start: startCooldown, remaining } = useEmailCooldown()

// 倒计时秒数 / 发送中标记
const countdown = ref(0) // 倒计时秒数
const isSending = ref(false) // 是否正在发送验证码
let countdownTimer = null // 倒计时定时器引用，onUnmounted 清理

// 倒计时跟随邮箱共享，切换视图后仍能恢复剩余秒数
const syncCountdown = () => {
  countdown.value = remaining(props.email)
  if (countdown.value > 0) {
    startTicker()
  } else {
    stopTicker()
  }
}

const startTicker = () => {
  if (countdownTimer) return
  countdownTimer = setInterval(syncCountdown, 1000)
}

const stopTicker = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

watch(() => props.email, syncCountdown)
onMounted(syncCountdown)
onUnmounted(stopTicker)

// ============================================================
// 表单校验
// ============================================================

const emailRules = [
  (v) => !!v || '请输入邮箱',
  (v) =>
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      v
    ) || '邮箱格式不正确'
]

const codeRules = [(v) => !!v || '请输入验证码', (v) => /^\d{6}$/.test(v) || '验证码必须是 6 位数字']

// ============================================================
// 发送验证码
// ============================================================

/**
 * 发送验证码：只校验邮箱字段，成功后启动按邮箱共享的 60 秒冷却
 */
const handleSendCode = async () => {
  // 直接调字段级 validate（Vuetify 输入框暴露 validate()），无需经过外层表单
  const errors = await emailFieldRef.value.validate()
  if (errors.length > 0) {
    return
  }

  isSending.value = true

  try {
    // 调用发送验证码的接口
    await emailCodeSendApi({ email: props.email, type: props.type })

    startCooldown(props.email)
    syncCountdown()
  } catch (error) {
    // 本地无计时（刷新/多设备）时，命中服务端限流也补上冷却
    if (String(error).includes('发送过于频繁')) {
      startCooldown(props.email)
      syncCountdown()
    }
    console.error('发送验证码失败:', error)
  } finally {
    isSending.value = false
  }
}
</script>
