<template>
  <div class="change-password-container">
    <el-card class="password-card">
      <template #header>
        <div class="card-head">
          <span class="title">修改密码</span>
          <span class="subtitle">{{ emailMode ? '通过邮箱验证码验证身份' : '使用当前密码验证身份' }}</span>
        </div>
      </template>

      <el-form ref="formRef" :model="formModel" :rules="rules" label-width="120px" class="password-form" size="small">
        <template v-if="!emailMode">
          <el-form-item label="原密码" prop="oldPassword">
            <el-input
              v-model="formModel.oldPassword"
              type="password"
              placeholder="请输入原密码"
              show-password
              :prefix-icon="Lock"
            />
          </el-form-item>
        </template>

        <template v-else>
          <SmartEmailCodeField
            v-model:email="formModel.email"
            v-model:code="formModel.verifyCode"
            type="reset"
            email-label="账号邮箱"
            email-disabled
          />
        </template>

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

        <!-- 密码强度提示 -->
        <el-form-item label="密码强度" v-if="formModel.newPassword">
          <div class="password-strength">
            <el-progress
              :percentage="passwordStrength.percentage"
              :status="passwordStrength.status"
              :show-text="false"
              style="width: 200px"
            />
            <el-text :type="passwordStrength.color" size="small">
              {{ passwordStrength.text }}
            </el-text>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading" size="small" plain> 确认修改 </el-button>
          <el-button type="info" @click="handleReset" size="small" plain> 重置 </el-button>
          <el-button v-if="!emailMode" link type="primary" size="small" class="forgot-link" @click="switchToEmail">
            忘记旧密码？改用邮箱验证 →
          </el-button>
          <el-button v-else link type="primary" size="small" class="forgot-link" @click="switchToPassword">
            返回旧密码验证 ←
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import msg from '@/components/msg'
import { Lock } from '@element-plus/icons-vue'
import SmartEmailCodeField from '@/components/SmartEmailCodeField.vue'
import { userUpdatePwdApi, userResetPwdByEmailApi } from '@/api/admin'
import { PASSWORD_REGEX, PASSWORD_MESSAGE, getPasswordStrength } from '@/utils/password'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { clearRoute } from '@/utils/remove'
import { useRouter } from 'vue-router'

// ============================================================
// 数据
// ============================================================
const tokenStore = useTokenStore()
const userStore = useUserStore()
const router = useRouter()

const formRef = ref()
const loading = ref(false)
const emailMode = ref(false)

const formModel = reactive({
  oldPassword: '',
  email: '',
  verifyCode: '',
  newPassword: '',
  confirmPassword: ''
})

// ============================================================
// 密码强度
// ============================================================
const passwordStrength = computed(() => getPasswordStrength(formModel.newPassword))

// ============================================================
// 表单校验
// ============================================================
// 新密码不能与原密码相同（邮箱模式没有原密码可比较）
const validateNewPassword = (rule, value, callback) => {
  if (!emailMode.value && value === formModel.oldPassword) {
    return callback(new Error('新密码不能与原密码相同'))
  }
  callback()
}

// 两次密码一致性校验
const validateConfirmPassword = (rule, value, callback) => {
  if (value !== formModel.newPassword) {
    return callback(new Error('两次输入的密码不一致'))
  }
  callback()
}

const rules = reactive({
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  verifyCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码必须是 6 位数字', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { pattern: PASSWORD_REGEX, message: PASSWORD_MESSAGE, trigger: 'blur' },
    { validator: validateNewPassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
})

// ============================================================
// 方法
// ============================================================
// 切换邮箱验证：邮箱取自账号绑定邮箱，前端只做展示
const switchToEmail = () => {
  if (!userStore.userInfo.email) {
    msg.warning('当前账号未绑定邮箱，请先在基本资料中绑定')
    return
  }
  formModel.email = userStore.userInfo.email
  formModel.verifyCode = ''
  emailMode.value = true
  formRef.value?.clearValidate()
}

const switchToPassword = () => {
  emailMode.value = false
  formModel.verifyCode = ''
  formRef.value?.clearValidate()
}

// t_user_request：修改密码请求（旧密码 / 邮箱验证码两种校验方式）
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    const tip = emailMode.value
      ? `本次重置将校验发送至 ${formModel.email} 的验证码，修改后需要重新登录。确定继续吗？`
      : '确定要修改密码吗？修改后需要重新登录。'

    await ElMessageBox.confirm(tip, '修改密码确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    loading.value = true

    if (emailMode.value) {
      await userResetPwdByEmailApi({
        verifyCode: formModel.verifyCode,
        newPassword: formModel.newPassword,
        confirmPassword: formModel.confirmPassword
      })
    } else {
      await userUpdatePwdApi({
        oldPassword: formModel.oldPassword,
        newPassword: formModel.newPassword,
        confirmPassword: formModel.confirmPassword
      })
    }

    msg.primary('密码修改成功，请重新登录')

    handleReset()

    // 清除用户记住密码凭证
    tokenStore.clearCredentials()

    // 后端已使登录态失效，前端同步清理并回登录页，避免停留在“已登录”的假状态
    tokenStore.removeToken()
    clearRoute(userStore.userMenu)
    userStore.clearUserStore()
    router.replace('/login')
  } catch (error) {
    if (error === 'cancel') {
      msg.info('已取消修改')
    }
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  formRef.value?.resetFields()
  // 手动清空数据，确保响应式更新
  Object.assign(formModel, {
    oldPassword: '',
    email: emailMode.value ? userStore.userInfo.email || '' : '',
    verifyCode: '',
    newPassword: '',
    confirmPassword: ''
  })
}
</script>

<style scoped>
.change-password-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.password-card {
  margin-bottom: 20px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.card-head .title {
  font-size: 15px;
  font-weight: 600;
}

.subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.password-form {
  margin-top: 20px;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 12px;
}

.security-tips {
  color: #bbb;
  font-size: 12px;
  line-height: 1.8;
  padding-left: 16px;
}

.security-tips li {
  margin-bottom: 8px;
}

.tips-card {
  margin-top: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .change-password-container {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .password-form :deep(.el-form-item__label) {
    width: 100px !important;
  }

  /* 链接换行后移除 EP 相邻按钮默认的 12px 左间距，并补一点上下间距 */
  .forgot-link {
    width: 100%;
    margin-top: 8px;
    margin-left: 0 !important;
    justify-content: flex-start;
  }
}

/* 自定义输入框样式 */
:deep(.el-input) {
  max-width: 300px;
}
</style>
