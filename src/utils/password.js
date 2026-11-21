/**
 * 密码规则唯一来源，需与后端 PasswordConstants、客户端 front/client 的 utils/password.js 保持一致
 */

// 6-20 位非空白字符
export const PASSWORD_REGEX = /^\S{6,20}$/

export const PASSWORD_MESSAGE = '密码必须是 6-20 位的非空字符'

/**
 * 计算密码强度（长度 + 字符类型）
 * @param {String} password 密码
 * @returns {Object} { percentage, text, status, color }
 */
export const getPasswordStrength = (password) => {
  if (!password) return { percentage: 0, text: '未输入', status: undefined, color: 'info' }

  let value = 0
  if (password.length >= 6) value += 25
  if (password.length >= 12) value += 10
  if (/[a-z]/.test(password)) value += 15
  if (/[A-Z]/.test(password)) value += 15
  if (/[0-9]/.test(password)) value += 15
  if (/[^a-zA-Z0-9]/.test(password)) value += 20
  value = Math.min(value, 100)

  if (value < 40) return { percentage: value, text: '弱', status: 'exception', color: 'danger' }
  if (value < 70) return { percentage: value, text: '中', status: 'warning', color: 'warning' }
  return { percentage: value, text: '强', status: 'success', color: 'success' }
}
