<template>
  <el-form-item :label="emailLabel" prop="email">
    <el-input v-model="emailModel" :disabled="emailDisabled" :placeholder="emailPlaceholder" prefix-icon="Message" />
  </el-form-item>

  <el-form-item label="验证码" prop="verifyCode">
    <div class="code-field">
      <el-input v-model="codeModel" maxlength="6" placeholder="请输入验证码" prefix-icon="Key" />
      <el-button :disabled="countdown > 0 || isSending" @click="handleSendCode">
        {{ countdown > 0 ? `${countdown} 秒后重试` : isSending ? '发送中...' : '获取验证码' }}
      </el-button>
    </div>
  </el-form-item>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import msg from '@/components/msg'
import { emailCodeSendApi, emailResetCodeSendApi, forgotEmailCodeSendApi, emailCancelCodeSendApi } from '@/api/email'
import { useEmailCooldown } from '@/utils/emailCooldown'

const props = defineProps({
  email: {
    type: String,
    default: ''
  },
  code: {
    type: String,
    default: ''
  },
  // change-绑定/更换邮箱，reset-重置密码（邮箱取自当前账号），forgot-忘记密码（匿名），cancel-注销账号（邮箱取自当前账号）
  type: {
    type: String,
    default: 'change'
  },
  emailLabel: {
    type: String,
    default: '邮箱'
  },
  emailDisabled: {
    type: Boolean,
    default: false
  },
  emailPlaceholder: {
    type: String,
    default: '请输入邮箱'
  }
})

const emit = defineEmits(['update:email', 'update:code'])

const emailModel = computed({
  get: () => props.email,
  set: (value) => emit('update:email', value)
})

const codeModel = computed({
  get: () => props.code,
  set: (value) => emit('update:code', value)
})

const { start: startCooldown, remaining } = useEmailCooldown()

const countdown = ref(0)
const isSending = ref(false)
let countdownTimer = null

// 与后端 EmailCodeDTO 保持一致
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// 倒计时跟随邮箱共享，切换视图/弹窗后仍能恢复剩余秒数
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

const handleSendCode = async () => {
  if (!EMAIL_REGEX.test(props.email)) {
    msg.warning('请输入正确的邮箱地址')
    return
  }

  isSending.value = true
  try {
    if (props.type === 'reset') {
      await emailResetCodeSendApi()
    } else if (props.type === 'cancel') {
      await emailCancelCodeSendApi()
    } else if (props.type === 'forgot') {
      await forgotEmailCodeSendApi({ email: props.email })
    } else {
      await emailCodeSendApi({ email: props.email })
    }
    startCooldown(props.email)
    syncCountdown()
  } catch (error) {
    // 本地无计时（刷新/多设备）时，命中服务端限流也补上冷却
    if (String(error).includes('发送过于频繁')) {
      startCooldown(props.email)
      syncCountdown()
    }
    // 接口错误已由 request.js 拦截器统一提示
    console.error('发送验证码失败:', error)
  } finally {
    isSending.value = false
  }
}
</script>

<style scoped>
.code-field {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
