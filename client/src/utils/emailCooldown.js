const STORAGE_KEY = 'client:email-code-cooldown'
const LIMIT_MS = 60 * 1000

const readState = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

const state = readState()

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储不可用时仅保留内存态
  }
}

const normalize = (email) => (email || '').trim()

/**
 * 邮箱验证码冷却：按邮箱共享，与服务端 60 秒/邮箱的限流口径一致
 */
export const useEmailCooldown = () => {
  const start = (email) => {
    const key = normalize(email)
    if (!key) return
    state[key] = Date.now() + LIMIT_MS
    persist()
  }

  const remaining = (email) => {
    const key = normalize(email)
    if (!key) return 0
    return Math.max(0, Math.ceil(((state[key] || 0) - Date.now()) / 1000))
  }

  return { start, remaining }
}
