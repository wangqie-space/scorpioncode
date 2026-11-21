<template>
  <div class="forgot-password">
    <h3 class="title">找回密码</h3>
    <p class="subtitle">仅支持已绑定邮箱的账号</p>

    <el-steps :active="activeStep" finish-status="success" align-center :class="'step-' + step" class="steps">
      <el-step title="验证邮箱" />
      <el-step title="设置密码" />
      <el-step title="完成" />
    </el-steps>

    <el-form
      v-if="step === 0"
      ref="verifyFormRef"
      :model="formModel"
      :rules="verifyRules"
      label-position="top"
      size="large"
    >
      <SmartEmailCodeField v-model:email="formModel.email" v-model:code="formModel.verifyCode" type="forgot" />
      <p class="note">若该邮箱已绑定账号，验证码将发送至该邮箱</p>
    </el-form>

    <el-form
      v-else-if="step === 1"
      ref="passwordFormRef"
      :model="formModel"
      :rules="passwordRules"
      label-position="top"
      size="large"
    >
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="formModel.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
          :prefix-icon="Lock"
        />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="formModel.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
          show-password
          :prefix-icon="Lock"
        />
      </el-form-item>

      <div v-if="formModel.newPassword" class="strength">
        <el-progress :percentage="strength.percentage" :status="strength.status" :show-text="false" />
        <span>密码强度：{{ strength.text }}</span>
      </div>
    </el-form>

    <el-result v-else icon="success" title="密码重置成功" sub-title="请使用新密码重新登录" />

    <div class="actions">
      <el-button v-if="step === 0" type="primary" size="large" class="submit" @click="nextStep">下一步</el-button>

      <div v-else-if="step === 1" class="step-actions">
        <el-button size="large" @click="step = 0">上一步</el-button>
        <el-button type="primary" size="large" :loading="loading" @click="submit">确认重置</el-button>
      </div>

      <el-button v-else type="primary" size="large" class="submit" @click="$emit('back')">返回登录</el-button>

      <div v-if="step < 2" class="back">
        <el-button link type="primary" @click="$emit('back')">返回登录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import SmartEmailCodeField from '@/components/SmartEmailCodeField.vue'
import { userForgotPwdApi } from '@/api/admin'
import { PASSWORD_REGEX, PASSWORD_MESSAGE, getPasswordStrength } from '@/utils/password'

defineEmits(['back'])

const step = ref(0)
const loading = ref(false)

// 完成时 active 越过最后一步，让三步全部显示为完成态
const activeStep = computed(() => (step.value === 2 ? 3 : step.value))
const verifyFormRef = ref()
const passwordFormRef = ref()

const formModel = reactive({
  email: '',
  verifyCode: '',
  newPassword: '',
  confirmPassword: ''
})

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const verifyRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { pattern: EMAIL_REGEX, message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  verifyCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码必须是 6 位数字', trigger: 'blur' }
  ]
}

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== formModel.newPassword) {
    return callback(new Error('两次输入的密码不一致'))
  }
  callback()
}

const passwordRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { pattern: PASSWORD_REGEX, message: PASSWORD_MESSAGE, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const strength = computed(() => getPasswordStrength(formModel.newPassword))

const nextStep = async () => {
  if (!verifyFormRef.value) return
  try {
    await verifyFormRef.value.validate()
  } catch {
    return
  }
  step.value = 1
}

const submit = async () => {
  if (!passwordFormRef.value) return
  try {
    await passwordFormRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await userForgotPwdApi({
      email: formModel.email,
      verifyCode: formModel.verifyCode,
      newPassword: formModel.newPassword,
      confirmPassword: formModel.confirmPassword
    })
    step.value = 2
  } catch (error) {
    // 接口错误已由 request.js 拦截器统一提示（如 218 账号已停用 / 223 验证码错误）
    console.error('重置密码失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.forgot-password {
  padding-bottom: 10px;
}

.title {
  margin: 0 auto 6px;
  color: #444;
  font-size: large;
  text-align: center;
}

.subtitle {
  margin: 0 0 20px;
  color: #666;
  font-size: 12px;
  text-align: center;
}

.steps {
  margin-bottom: 22px;
}

/* EP 默认只填充“已完成步骤”的线；停在设置密码时把 ①→② 这段补上 */
.step-1 :deep(.el-step:nth-child(1) .el-step__line-inner) {
  width: 100% !important;
  border-width: 1px !important;
}

.note {
  margin: -4px 0 16px;
  color: #8a8f99;
  font-size: 12px;
  line-height: 1.5;
}

.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -6px 0 16px;
  color: #8a8f99;
  font-size: 12px;
}

.strength .el-progress {
  flex: 1;
}

.actions {
  margin-top: 4px;
}

.submit {
  width: 100%;
}

.step-actions {
  display: flex;
  gap: 10px;
}

.step-actions .el-button {
  flex: 1;
}

.back {
  margin-top: 10px;
  text-align: center;
}

:deep(.el-input__wrapper) {
  box-shadow: none;
  background-color: #fff;
}

:deep(.el-form-item__label) {
  color: #606266;
}
</style>
