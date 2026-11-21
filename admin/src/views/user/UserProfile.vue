<template>
  <div class="user-profile-container">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <span class="title">个人信息</span>
          <div class="header-actions">
            <el-button size="small" type="danger" icon="Delete" @click="openCancelDialog" plain>注销账号</el-button>
            <el-button size="small" type="primary" icon="Edit" @click="editMode = !editMode" plain>
              {{ editMode ? '取消编辑' : '编辑资料' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 用户信息展示/编辑 -->
      <div class="profile-content">
        <!-- 头像区域 -->
        <div class="avatar-section">
          <div class="avatar-upload">
            <el-avatar :size="100" :src="imgUrl || avatar" class="user-avatar" />
            <el-upload
              v-if="editMode"
              class="avatar-uploader"
              :auto-upload="false"
              :show-file-list="false"
              name="avatar"
              :onChange="handleSelectAvatar"
            >
              <el-button type="primary" icon="Upload" size="small" plain> 更换头像 </el-button>
            </el-upload>
          </div>
        </div>

        <!-- 基本信息表单 -->
        <el-form :model="userInfo" :rules="rules" ref="formRef" label-width="100px" class="info-form" size="small">
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="用户名">
                <el-input v-model="userInfo.username" :disabled="true" placeholder="请输入用户名" />
              </el-form-item>
            </el-col>

            <el-col :xs="24" :sm="12">
              <el-form-item label="昵称" prop="nickname">
                <el-input v-model="userInfo.nickname" :disabled="!editMode" placeholder="请输入昵称" />
              </el-form-item>
            </el-col>

            <el-col :xs="24" :sm="12">
              <el-form-item label="邮箱">
                <div class="email-field">
                  <el-input v-model="userInfo.email" disabled placeholder="未绑定邮箱" />
                  <el-button v-if="editMode" size="small" type="primary" plain @click="openEmailDialog">
                    {{ userInfo.email ? '更换' : '绑定' }}
                  </el-button>
                </div>
              </el-form-item>
            </el-col>

            <el-col :xs="24" :sm="12">
              <el-form-item label="手机号" prop="phone">
                <el-input v-model="userInfo.phone" :disabled="!editMode" placeholder="请输入手机号" />
              </el-form-item>
            </el-col>

            <el-col :span="24">
              <el-form-item label="个人简介">
                <el-input
                  v-model="userInfo.bio"
                  type="textarea"
                  :rows="3"
                  :disabled="!editMode"
                  placeholder="写点关于你自己的介绍吧～"
                  maxlength="200"
                  show-word-limit
                />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <!-- 操作按钮 -->
        <div class="action-buttons" v-if="editMode">
          <el-button type="info" @click="handleCancel" size="small" plain>取消</el-button>
          <el-button type="primary" @click="handleSave" :loading="loading" size="small" plain> 保存修改 </el-button>
        </div>
      </div>
    </el-card>

    <!-- 其他信息卡片 -->
    <el-row :gutter="20" class="additional-info">
      <el-col :xs="24" :sm="12">
        <el-card>
          <template #header>
            <span style="font-size: 15px">账号信息</span>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="label">注册时间：</span>
              <span class="value">{{ profileStats.createTime }}</span>
            </div>
            <div class="info-item">
              <span class="label">最后登录：</span>
              <span class="value">{{ profileStats.lastLogin }}</span>
            </div>
            <div class="info-item">
              <span class="label">用户角色：</span>
              <div class="role-tags">
                <el-tag
                  v-for="(role, index) in userStore.roleNames"
                  :key="index"
                  type="success"
                  size="default"
                  class="role-tag"
                >
                  {{ role }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12">
        <el-card>
          <template #header>
            <span style="font-size: 15px">系统信息</span>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="label">登录次数：</span>
              <span class="value">{{ profileStats.loginCount }} 次</span>
            </div>
            <div class="info-item">
              <span class="label">账号状态：</span>
              <el-tag :type="profileStats.status === 0 ? 'success' : 'danger'">
                {{ profileStats.status === 0 ? '正常' : '禁用' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== 绑定/更换邮箱弹窗 ===== -->
    <el-dialog v-model="emailDialogVisible" :title="userInfo.email ? '更换邮箱' : '绑定邮箱'" width="420px">
      <el-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-width="90px" size="small">
        <SmartEmailCodeField
          v-model:email="emailForm.email"
          v-model:code="emailForm.verifyCode"
          type="change"
          email-label="新邮箱"
          email-placeholder="请输入新邮箱"
        />
      </el-form>
      <template #footer>
        <el-button size="small" @click="emailDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="emailLoading" @click="handleChangeEmail">确定</el-button>
      </template>
    </el-dialog>

    <!-- ===== 注销账号弹窗 ===== -->
    <el-dialog v-model="cancelDialogVisible" title="注销账号" width="420px" class="cancel-dialog">
      <el-alert type="error" :closable="false" show-icon title="注销后账号将被删除且无法恢复" class="cancel-tip" />
      <el-form ref="cancelFormRef" :model="cancelForm" :rules="cancelRules" label-width="90px" size="small">
        <SmartEmailCodeField
          v-model:email="cancelForm.email"
          v-model:code="cancelForm.verifyCode"
          type="cancel"
          email-label="邮箱"
          email-disabled
          email-placeholder="未绑定邮箱"
        />
      </el-form>
      <template #footer>
        <el-button size="small" @click="cancelDialogVisible = false">取消</el-button>
        <el-button size="small" type="danger" :loading="cancelLoading" @click="handleCancelAccount">确认注销</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/user'
import avatar from '@/assets/images/avatar-circle.png'
import { userInfoApi, userStatsApi, userUpdateInfoApi, userChangeEmailApi, userCancelApi } from '@/api/admin'
import SmartEmailCodeField from '@/components/SmartEmailCodeField.vue'
import websocketManager from '@/server/websocketManager'
import msg from '@/components/msg'

// ============================================================
// 数据
// ============================================================
const editMode = ref(false)
const loading = ref(false)
const formRef = ref()
const imgUrl = ref('')
const userStore = useUserStore()

// 用户信息数据（写死的数据）
const userInfo = reactive({
  ...userStore.userInfo
})

// 统计数据用本地 ref（不与 store 混合）
const profileStats = ref({
  createTime: '',
  status: 0,
  lastLogin: '',
  loginCount: 0
})

// 备份原始数据用于取消编辑时恢复
const originalUserInfo = ref({})

// 邮箱绑定/更换弹窗
const emailDialogVisible = ref(false)
const emailFormRef = ref()
const emailLoading = ref(false)
const emailForm = reactive({ email: '', verifyCode: '' })

// 注销账号弹窗
const cancelDialogVisible = ref(false)
const cancelFormRef = ref()
const cancelLoading = ref(false)
const cancelForm = reactive({ email: '', verifyCode: '' })

// ============================================================
// 表单校验
// ============================================================
const rules = reactive({
  phone: [
    // 允许为空：清空后提交空串，后端置 null
    { pattern: /^(1[3-9]\d{9})?$/, message: '请输入正确的手机号码', trigger: 'blur' }
  ],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }]
})

// 验证码规则（邮箱绑定/注销共用）
const verifyCodeRules = [
  { required: true, message: '请输入验证码', trigger: 'blur' },
  { pattern: /^\d{6}$/, message: '验证码必须是 6 位数字', trigger: 'blur' }
]

// 绑定/更换邮箱弹窗校验
const emailRules = reactive({
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    {
      pattern:
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      message: '请输入正确的邮箱地址',
      trigger: 'blur'
    },
    // 与当前邮箱相同无意义，避免白走一轮验证码
    {
      validator: (rule, value, callback) => {
        if (value && value === userInfo.email) return callback(new Error('新邮箱不能与当前邮箱相同'))
        callback()
      },
      trigger: 'blur'
    }
  ],
  verifyCode: verifyCodeRules
})

// 注销账号弹窗校验（邮箱锁定为当前账号，只校验验证码）
const cancelRules = reactive({
  verifyCode: verifyCodeRules
})

// ============================================================
// 方法
// ============================================================
const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!allowedTypes.includes(file.type)) {
    msg.error('必须为 jpg | png | jpeg 格式')
    return false
  }
  if (!isLt2M) {
    msg.error('头像大小不能超过 2MB!')
    return false
  }
  return true
}

const handleSelectAvatar = (file) => {
  // 先进行校验
  if (!validateFile(file.raw)) {
    return // 校验失败，不继续执行
  }

  imgUrl.value = URL.createObjectURL(file.raw)
  userInfo.avatar = file.raw
}

// t_user_request：用户统计信息请求
/**
 * 获取用户统计数据
 */
const fetchProfileStats = async () => {
  try {
    const res = await userStatsApi()
    if (res.code === 200) {
      profileStats.value = {
        createTime: res.data.createTime,
        status: res.data.status !== undefined ? res.data.status : 0,
        lastLogin: res.data.lastLogin,
        loginCount: res.data.loginCount
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    // 静默失败，不影响主流程
  }
}

// t_user_request：修改用户信息请求
const handleSave = async () => {
  console.log(userInfo === userStore.userInfo)
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true
    // await modifyApi(userInfo)
    // 更新备份数据
    // Object.assign(originalUserInfo.value, { ...userInfo })
    // 发送请求
    await userUpdateInfoApi(userInfo)
    const res = await userInfoApi()
    Object.assign(userStore.userInfo, res.data.userInfo)
    // 刷新取消编辑的备份，否则下次取消会回滚到进入页面时的旧资料
    Object.assign(originalUserInfo.value, { ...userInfo })
    editMode.value = false
    loading.value = false
    msg.primary('个人信息更新成功')
  } catch (error) {
    loading.value = false

    // 表单验证失败才提示；接口错误已由 request.js 拦截器统一弹后端文案，避免双弹且被写死文案盖掉
    if (error?.fields) {
      msg.error('请完善表单信息')
    } else {
      console.error('API 请求错误:', error)
    }
  }
}

const handleCancel = () => {
  // 恢复原始数据
  Object.assign(userInfo, { ...originalUserInfo.value })
  editMode.value = false
  msg.info('已取消编辑')
  imgUrl.value = originalUserInfo.value.avatar
}

// 打开弹窗：清空上次输入与校验状态
const openEmailDialog = () => {
  emailDialogVisible.value = true
  emailForm.email = ''
  emailForm.verifyCode = ''
  emailFormRef.value?.clearValidate()
}

// 提交绑定/更换：后端验码、查重、落库一次完成，成功后刷新回显
const handleChangeEmail = async () => {
  if (!emailFormRef.value) return
  try {
    await emailFormRef.value.validate()
  } catch {
    return
  }

  emailLoading.value = true
  try {
    await userChangeEmailApi({ email: emailForm.email, verifyCode: emailForm.verifyCode })
    const res = await userInfoApi()
    Object.assign(userStore.userInfo, res.data.userInfo)
    Object.assign(userInfo, res.data.userInfo)
    Object.assign(originalUserInfo.value, { ...userInfo })
    emailDialogVisible.value = false
    msg.success('邮箱已更新')
  } catch (error) {
    // 接口错误已由 request.js 拦截器统一提示（如 223 验证码错误 / 236 邮箱已被占用）
    console.error('更换邮箱失败:', error)
  } finally {
    emailLoading.value = false
  }
}

// 打开注销弹窗：邮箱锁定为当前账号邮箱
const openCancelDialog = () => {
  if (!userInfo.email) {
    msg.warning('请先绑定邮箱后再注销账号')
    return
  }
  cancelForm.email = userInfo.email
  cancelForm.verifyCode = ''
  cancelDialogVisible.value = true
  cancelFormRef.value?.clearValidate()
}

// 注销不可逆：先校验验证码，再弹一次确认
const handleCancelAccount = async () => {
  if (!cancelFormRef.value) return
  try {
    await cancelFormRef.value.validate()
  } catch {
    return
  }

  try {
    await ElMessageBox.confirm('注销后账号将被删除且无法恢复，确定要继续吗？', '确认注销账号', {
      type: 'warning',
      confirmButtonText: '确认注销',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
  } catch {
    return
  }

  // 连点会重复提交，确认后到请求结束前直接拦住
  if (cancelLoading.value) return
  cancelLoading.value = true
  try {
    await userCancelApi({ verifyCode: cancelForm.verifyCode })
    cancelDialogVisible.value = false
    msg.success('账号已注销')
    // 复用统一退出清理：清 token/动态路由/用户信息并跳登录页
    websocketManager.logoutAndRedirect()
  } catch (error) {
    // 接口错误已由 request.js 拦截器统一提示
    console.error('注销账号失败:', error)
  } finally {
    cancelLoading.value = false
  }
}

// ============================================================
// 生命周期
// ============================================================
// 初始化备份数据
onMounted(async () => {
  Object.assign(originalUserInfo.value, { ...userInfo })
  imgUrl.value = originalUserInfo.value.avatar

  // 获取统计数据
  await fetchProfileStats()
})
</script>

<style scoped>
.user-profile-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.profile-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.cancel-tip {
  margin-bottom: 18px;
}

.card-header .title {
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.profile-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-section {
  margin-bottom: 30px;
  text-align: center;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

/* .user-avatar {
  border: 3px solid #f0f0f0;
} */

.info-form {
  width: 100%;
  max-width: 800px;
}

.email-field {
  display: flex;
  gap: 8px;
  width: 100%;
}

.action-buttons {
  margin-top: 30px;
  text-align: center;
}

.additional-info {
  margin-top: 20px;
  font-size: 12px;
  row-gap: 20px; /* 移动端卡片上下堆叠时的间距，与个人信息卡片间距一致（桌面单行时无影响） */
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.info-item .value {
  color: var(--el-text-color-regular);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-profile-container {
    padding: 10px;
  }

  .profile-content {
    align-items: stretch;
  }

  .avatar-upload {
    flex-direction: column;
  }
}
</style>

<style lang="scss">
.cancel-dialog .el-dialog__title {
  font-size: 16px !important;
}
</style>
