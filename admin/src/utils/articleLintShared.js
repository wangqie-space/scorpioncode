// 文案口径的公共工具：汉字判定、URL 与路径保护、区间遮罩、间距与标点检查、条目构造

const HAN = /\p{Script=Han}/u
const PLACEHOLDER = /\{\}|%(\d+\$)?[dsx]/g
const SCHEME_CH = /[A-Za-z0-9+.-]/
const URL_CH = /[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]/
const MAX_SNIPPET = 16

export const isHan = (c) => !!c && HAN.test(c)
export const isAlnum = (c) => !!c && /[0-9A-Za-z]/.test(c)
export const isBlank = (line) => line.trim() === ''
// 遮罩串里位置值为 \u0000 才算不参与校验，普通字符不能当布尔用
export const isMasked = (masked, i) => masked[i] === '\u0000'

/** URL 与含扩展名的路径：内部不补空格，硬改会让引用失效 */
export const protectRanges = (s) => {
  const raw = []
  for (let i = s.indexOf('://'); i !== -1; i = s.indexOf('://', i + 3)) {
    let a = i
    while (a > 0 && SCHEME_CH.test(s[a - 1])) a--
    let b = i + 3
    while (b < s.length && URL_CH.test(s[b])) b++
    raw.push([a, b])
  }
  const re = /\S*[\\/]\S*/g
  let m
  while ((m = re.exec(s))) {
    const ext = /\.[A-Za-z0-9]{1,6}/.exec(m[0])
    if (!ext) continue
    let a = m.index
    let b = m.index + ext.index + ext[0].length
    while (a < b && !/[A-Za-z0-9]/.test(s[a])) a++
    while (b > a && !/[A-Za-z0-9]/.test(s[b - 1])) b--
    raw.push([a, b])
  }
  return raw
}

/** 区间合并，遮罩时少做无用遍历 */
export const mergeRanges = (ranges) => {
  const sorted = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([...r])
  }
  return out
}

/** 把不参与校验的区间换成等长占位符，保证下标与原文一致 */
export const maskRanges = (line, ranges) => {
  if (!ranges.length) return line
  const chars = line.split('')
  for (const [a, b] of ranges) {
    for (let i = a; i < b && i < chars.length; i++) chars[i] = '\u0000'
  }
  return chars.join('')
}

/** 只放开 [a, b) 区间，其余位置遮罩，便于在字符串内部单独跑代码规则 */
export const maskOutside = (line, masked, a, b) => {
  let out = ''
  for (let i = 0; i < line.length; i++) out += i >= a && i < b ? masked[i] : '\u0000'
  return out
}

/** 区间内再遮罩成对引号里的内容，字符串里的冒号与逗号不按代码算 */
export const maskRange = (line, masked, a, b) => {
  const chars = maskOutside(line, masked, a, b).split('')
  let quote = null
  for (let i = a; i < b && i < chars.length; i++) {
    const c = line[i]
    if (quote) {
      chars[i] = '\u0000'
      if (c === '\\') {
        if (i + 1 < b) chars[i + 1] = '\u0000'
        i++
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      chars[i] = '\u0000'
    }
  }
  return chars.join('')
}

/** 汉字与字母/数字之间缺空格，含占位符与汉字相邻 */
export const findSpacing = (line, start, end, masked) => {
  for (let i = start; i + 1 < end; i++) {
    if (isMasked(masked, i) || isMasked(masked, i + 1)) continue
    if ((isHan(line[i]) && isAlnum(line[i + 1])) || (isAlnum(line[i]) && isHan(line[i + 1]))) {
      return { start: i, end: i + 2, message: '汉字与字母/数字之间应有一个空格' }
    }
  }
  PLACEHOLDER.lastIndex = 0
  let m
  while ((m = PLACEHOLDER.exec(line))) {
    const s = m.index
    const e = s + m[0].length
    if (s < start || e > end) continue
    if (s > start && isHan(line[s - 1]) && !isMasked(masked, s - 1)) {
      return { start: s - 1, end: e, message: '占位符与汉字之间应有一个空格' }
    }
    if (e < end && isHan(line[e]) && !isMasked(masked, e)) {
      return { start: s, end: e + 1, message: '占位符与汉字之间应有一个空格' }
    }
  }
  return null
}

/** 紧邻汉字的半角标点应全角；日志里的冒号保持半角 */
export const findPunct = (line, start, end, masked, isLog) => {
  for (let i = start; i < end; i++) {
    if (isMasked(masked, i)) continue
    const prevHan = i > 0 && !isMasked(masked, i - 1) && isHan(line[i - 1])
    const nextHan = i + 1 < line.length && !isMasked(masked, i + 1) && isHan(line[i + 1])
    if (!prevHan && !nextHan) continue
    const c = line[i]
    if (c === ':' && !isLog) {
      if (line[i + 1] === '/') continue
      return { start: i, end: i + 1, message: '半角冒号应改为全角冒号' }
    }
    if (c === ',' || c === ';' || c === '!' || c === '?') {
      return { start: i, end: i + 1, message: '半角标点应改为全角标点' }
    }
    if (c === '(' && prevHan) {
      const close = line.indexOf(')', i)
      const inner = close === -1 ? '' : line.slice(i + 1, close)
      if (inner.trim()) return { start: i, end: i + 1, message: '中文括号应使用全角括号' }
    }
  }
  return null
}

export const issue = (field, level, rule, line, message, text, start, end) => {
  const hasHit = typeof start === 'number'
  return {
    field,
    level,
    rule,
    line,
    message,
    before: hasHit ? text.slice(Math.max(0, start - MAX_SNIPPET), start) : '',
    hit: hasHit ? text.slice(start, end) : '',
    after: hasHit ? text.slice(end, end + MAX_SNIPPET) : ''
  }
}
