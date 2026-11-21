import http from '@/utils/request'

/**
 * 发送绑定/更换邮箱验证码
 * @param {Object} params 新邮箱
 * @returns {Promise}
 */
export const emailCodeSendApi = (params) => http.post('/admin/email/code', params)

/**
 * 发送重置密码验证码（收件邮箱取当前账号绑定的邮箱）
 * @returns {Promise}
 */
export const emailResetCodeSendApi = () => http.post('/admin/email/password-code')

/**
 * 发送忘记密码验证码（匿名，仅对已绑定邮箱的管理端账号发码）
 * @param {Object} params 邮箱
 * @returns {Promise}
 */
export const forgotEmailCodeSendApi = (params) => http.post('/admin/email/forgot-code', params)

/**
 * 发送注销账号验证码（收件邮箱取当前账号绑定的邮箱）
 * @returns {Promise}
 */
export const emailCancelCodeSendApi = () => http.post('/admin/email/cancel-code')
