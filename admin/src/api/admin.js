import http from '@/utils/request'

/**
 * 管理员登录
 * @param {Object} params 登录参数
 * @returns {Promise}
 */
export const adminLoginApi = (params) => {
  return http.post('/admin/login', params)
}

/**
 * 获取用户信息
 * @returns {Promise}
 */
export const userInfoApi = () => {
  return http.get('/admin/userDetailInfo')
}

/**
 * 获取用户统计信息
 * @returns {Promise}
 */
export const userStatsApi = () => {
  return http.get('/admin/stats')
}

/**
 * 修改用户信息
 * @param {Object} params 用户资料（含头像文件）
 * @returns {Promise}
 */
export const userUpdateInfoApi = (params) => {
  const formData = new FormData()
  for (const k in params) {
    if (params[k] != null) {
      formData.append(k, params[k])
    }
  }
  return http.put('/admin/updateUserDetailInfo', formData, { timeout: 35000 }) // 资料/头像上传超时 35 秒
}

/**
 * 绑定/更换邮箱（需邮箱验证码）
 * @param {Object} params 新邮箱与验证码
 * @returns {Promise}
 */
export const userChangeEmailApi = (params) => {
  return http.put('/admin/email', params)
}

/**
 * 修改用户密码
 * @param {Object} params 密码参数
 * @returns {Promise}
 */
export const userUpdatePwdApi = (params) => {
  return http.patch('/admin/updateUserPwd', params)
}

/**
 * 通过绑定邮箱的验证码重置密码
 * @param {Object} params 验证码与新密码
 * @returns {Promise}
 */
export const userResetPwdByEmailApi = (params) => {
  return http.patch('/admin/updateUserPwdByEmail', params)
}

/**
 * 忘记密码（匿名，邮箱验证码重置）
 * @param {Object} params 邮箱、验证码与新密码
 * @returns {Promise}
 */
export const userForgotPwdApi = (params) => {
  return http.patch('/admin/password/forgot', params)
}

/**
 * 用户退出登录
 * @returns {Promise}
 */
export const adminLogoutApi = () => {
  return http.get('/admin/logout')
}

/**
 * 注销账号（需邮箱验证码）
 * @param {Object} params 邮箱验证码
 * @returns {Promise}
 */
export const userCancelApi = (params) => {
  return http.post('/admin/cancel', params)
}
