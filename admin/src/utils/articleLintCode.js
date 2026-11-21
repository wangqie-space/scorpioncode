// 代码块口径：围栏解析、注释与字符串扫描、各语言代码标点规则；行内代码同属代码块

import {
  isHan,
  isBlank,
  isMasked,
  protectRanges,
  maskRanges,
  maskOutside,
  maskRange,
  findSpacing,
  findPunct,
  issue
} from './articleLintShared'

/** 行内代码区间：成对反引号，闭合串长度与开启串一致 */
export const inlineCodeRanges = (line) => {
  const ranges = []
  let i = 0
  while (i < line.length) {
    if (line[i] !== '`') {
      i++
      continue
    }
    let n = 1
    while (line[i + n] === '`') n++
    let j = i + n
    let close = -1
    while (j < line.length) {
      if (line[j] === '`') {
        let m = 1
        while (line[j + m] === '`') m++
        if (m === n) {
          close = j
          break
        }
        j += m
      } else {
        j++
      }
    }
    if (close === -1) {
      i += n
      continue
    }
    ranges.push([i, close + n])
    i = close + n
  }
  return ranges
}

/** 行内代码与相邻汉字之间应有一个空格 */
export const findCodeGap = (line, ranges) => {
  for (const [a, b] of ranges) {
    if (a > 0 && isHan(line[a - 1])) return { start: a - 1, end: a + 1, message: '行内代码与汉字之间应有一个空格' }
    if (b < line.length && isHan(line[b]))
      return { start: b - 1, end: b + 1, message: '行内代码与汉字之间应有一个空格' }
  }
  return null
}

/** 围栏代码块的语言 → 注释语法 */
const codeStyle = (lang) => {
  const l = (lang || '').toLowerCase()
  if (!l) return 'slash'
  if (/^(xml|html|htm|xhtml|svg|wxml)$/.test(l)) return 'html'
  if (/^(bash|sh|shell|zsh|yml|yaml|properties|ini|conf|dockerfile|toml|python|py|ruby|rb|perl|pl|makefile)$/.test(l))
    return 'hash'
  if (/^(ahk|autohotkey|ahkv2)$/.test(l)) return 'ahk'
  if (/^(text|txt|plain|plaintext|log|diff|markdown|md|latex|tex)$/.test(l)) return 'none'
  return 'slash'
}

/** 代码风格族：js 查分号与花括号，css 查声明，其余语言只查逗号与冒号后空格 */
const codeKind = (lang) => {
  const l = (lang || '').toLowerCase()
  if (/^(js|javascript|jsx|ts|typescript|tsx|mjs|cjs)$/.test(l)) return 'js'
  if (/^(css|scss|sass|less|styl)$/.test(l)) return 'css'
  if (l === 'vue') return 'vue'
  return 'other'
}

/** js 行内的正则字面量：整体跳过，避免量词 {2,} 被当成代码标点 */
const regexRanges = (line) => {
  const ranges = []
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '/') continue
    if (line[i + 1] === '/' || line[i + 1] === '*') continue
    const prev = line[i - 1]
    const starts = i === 0 || /[=(,:;[!&|?{ ]/.test(prev) || /\breturn\s*$/.test(line.slice(0, i))
    if (!starts) continue
    let j = i + 1
    let closed = -1
    while (j < line.length) {
      if (line[j] === '\\') {
        j += 2
        continue
      }
      if (line[j] === '/') {
        closed = j
        break
      }
      if (/\s/.test(line[j])) break
      j++
    }
    if (closed === -1) continue
    ranges.push([i, closed + 1])
    i = closed
  }
  return ranges
}

/**
 * 代码行切出注释与字符串区间，标识符不查
 * @param {object} st 跨行状态 — 块注释与字符串可能跨行，由调用方持有
 */
const scanCodeLine = (line, style, st) => {
  const spans = []
  const close = (type, start, end) => {
    if (end > start) spans.push({ type, start, end })
  }
  // 跨行状态进入新行时从行首算起，否则区间起点会取到上一行的下标
  if (st.block) st.blockStart = 0
  if (st.quote) st.quoteStart = 0
  let i = 0
  while (i < line.length) {
    if (st.block) {
      const e = line.indexOf('*/', i)
      if (e === -1) {
        close('comment', st.blockStart, line.length)
        return spans
      }
      close('comment', st.blockStart, e + 2)
      st.block = false
      i = e + 2
      continue
    }
    if (st.quote) {
      // AHK 用反引号转义，其余语言用反斜杠
      if (line[i] === '\\' || (style === 'ahk' && line[i] === '`')) {
        i += 2
        continue
      }
      if (line[i] === st.quote) {
        close('string', st.quoteStart, i + 1)
        st.quote = null
      }
      i++
      continue
    }
    const ch = line[i]
    if (style === 'hash') {
      if (ch === '#' && (i === 0 || /[ \t]/.test(line[i - 1]))) {
        close('comment', i, line.length)
        return spans
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        st.quote = ch
        st.quoteStart = i
      }
      i++
      continue
    }
    if (style === 'html') {
      if (line.startsWith('<!--', i)) {
        const e = line.indexOf('-->', i)
        if (e === -1) {
          st.block = true
          st.blockStart = i
          return spans
        }
        close('comment', i, e + 3)
        i = e + 3
        continue
      }
      i++
      continue
    }
    if (style === 'ahk') {
      // AHK v2：; 在行首或前置空白才算注释，字符串用双引号
      if (ch === ';' && (i === 0 || /[ \t]/.test(line[i - 1]))) {
        close('comment', i, line.length)
        return spans
      }
      if (ch === '/' && line[i + 1] === '*') {
        st.block = true
        st.blockStart = i
        i += 2
        continue
      }
      if (ch === '"') {
        st.quote = ch
        st.quoteStart = i
      }
      i++
      continue
    }
    if (style === 'slash') {
      // vue 模板与 JSX 里的 <!-- --> 也当注释，避免注释掉的标签被校验
      if (line.startsWith('<!--', i)) {
        const e = line.indexOf('-->', i)
        if (e === -1) {
          st.block = true
          st.blockStart = i
          return spans
        }
        close('comment', i, e + 3)
        i = e + 3
        continue
      }
      if (ch === '/' && line[i + 1] === '*') {
        st.block = true
        st.blockStart = i
        i += 2
        continue
      }
      if (ch === '/' && line[i + 1] === '/' && line[i - 1] !== ':') {
        close('comment', i, line.length)
        return spans
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        st.quote = ch
        st.quoteStart = i
      }
      i++
      continue
    }
    i++
  }
  if (st.block) close('comment', st.blockStart, line.length)
  if (st.quote) close('string', st.quoteStart, line.length)
  return spans
}

/** 代码里第一个命中的位置，跳过注释、字符串与 URL/路径 */
const findCodeHit = (line, spans, masked, check) => {
  const inSpan = (i) => spans.some((s) => i >= s.start && i < s.end)
  for (let i = 0; i < line.length; i++) {
    if (isMasked(masked, i) || inSpan(i)) continue
    const hit = check(i)
    if (hit) return hit
  }
  return null
}

/** 箭头符号两侧各应有空格：js 的 => 与 java 的 -> */
const findArrow = (line, spans, masked, symbol) =>
  findCodeHit(line, spans, masked, (i) => {
    if (!line.startsWith(symbol, i)) return null
    // --> 是 HTML 注释收尾，->> 不是箭头
    if (symbol === '->' && (line[i - 1] === '-' || line[i + symbol.length] === '>')) return null
    const hit = { start: i, end: i + symbol.length }
    if (i > 0 && !/[ \t]/.test(line[i - 1])) return { ...hit, message: '箭头前应有一个空格' }
    const next = line[i + symbol.length]
    if (next !== undefined && !/[ \t]/.test(next)) return { ...hit, message: '箭头后应有一个空格' }
    return null
  })

/** 逗号后应有一个空格 */
const findComma = (line, spans, masked) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== ',') return null
    const next = line[i + 1]
    return next !== undefined && !/[ \t]/.test(next) ? { start: i, end: i + 1, message: '逗号后应有一个空格' } : null
  })

/** 逗号前不应有空格 */
const findCommaBefore = (line, spans, masked) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== ',' || !/[ \t]/.test(line[i - 1] || '')) return null
    return { start: i - 1, end: i + 1, message: '逗号前不应有空格' }
  })

/** 冒号前无空格、后一个空格 — strictBefore 只对 js 与 css 生效，Java 的增强 for 两边都有空格 */
const findColon = (line, spans, masked, strictBefore) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== ':' || line[i - 1] === ':' || line[i + 1] === ':' || line[i + 1] === '/') return null
    if (strictBefore && /[ \t]/.test(line[i - 1] || '')) {
      return { start: i - 1, end: i + 1, message: '冒号前不应有空格' }
    }
    const next = line[i + 1]
    return next !== undefined && !/[ \t]/.test(next) ? { start: i, end: i + 1, message: '冒号后应有一个空格' } : null
  })

/** js 族的花括号内侧各一个空格，正则量词 `{2,}` 不算 */
const findBraceSpace = (line, spans, masked) => {
  const isQuantifier = (from, to) => /^\d*(,\d*)?$/.test(line.slice(from, to)) && to > from
  return findCodeHit(line, spans, masked, (i) => {
    if (line[i] === '{' && line[i + 1] && !/[ \t]/.test(line[i + 1]) && line[i + 1] !== '}') {
      const close = line.indexOf('}', i)
      if (close !== -1 && isQuantifier(i + 1, close)) return null
      return { start: i, end: i + 2, message: '花括号内侧应有一个空格' }
    }
    if (line[i] === '}' && i > 0 && !/[ \t]/.test(line[i - 1]) && line[i - 1] !== '{') {
      const open = line.lastIndexOf('{', i)
      if (open !== -1 && isQuantifier(open + 1, i)) return null
      return { start: i - 1, end: i + 1, message: '花括号内侧应有一个空格' }
    }
    return null
  })
}

/** js 族的语句末尾不应有分号，单行块内的分号保留 */
const findJsSemicolon = (line, spans, masked) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== ';') return null
    let end = line.length
    for (const s of spans) if (s.type === 'comment' && s.start > i) end = Math.min(end, s.start)
    return line.slice(i + 1, end).trim() === '' ? { start: i, end: i + 1, message: '语句末尾不应有分号' } : null
  })

/** 模板表达式 ${...} 的内层按代码查逗号与冒号 */
const findTemplateExpr = (line, spans, masked) => {
  for (const span of spans) {
    if (span.type !== 'string') continue
    let i = span.start
    while (i < span.end) {
      const open = line.indexOf('${', i)
      if (open === -1 || open >= span.end) break
      let depth = 1
      let j = open + 2
      while (j < line.length && depth > 0) {
        if (line[j] === '{') depth++
        else if (line[j] === '}') depth--
        if (depth === 0) break
        j++
      }
      if (depth !== 0) break
      const inner = maskRange(line, masked, open + 2, j)
      const hit =
        findComma(line, [], inner) ||
        findCommaBefore(line, [], inner) ||
        findColon(line, [], inner, true) ||
        findArrow(line, [], inner, '=>')
      if (hit) return hit
      i = j + 1
    }
  }
  return null
}

/** 去掉注释标记后的内容 */
const commentBody = (line, span) => line.slice(span.start, span.end).replace(/^\s*(\/\/|#|\/\*|<![-][-])\s*/, '')

/** 注释里被注释掉的代码：首字符是英文或标签符号才按代码查，汉字开头的说明文字放行 */
const isCodeComment = (line, span) => /^[A-Za-z_$<{.#(\[@:]/.test(commentBody(line, span))

/** 注释内容是模板标签或指令时只查标签与绑定表达式，指令名里的冒号不算代码冒号 */
const isHtmlCommentCode = (line, span) => /^(?:[<@:#]|v-)/.test(commentBody(line, span))

/** vue 模板里绑定属性（:x / @x / #x / v-xxx）的值是表达式，按代码查逗号与冒号 */
const findTemplateAttrExpr = (line, spans, masked) => {
  const inComment = (i) => spans.some((s) => s.type === 'comment' && i >= s.start && i < s.end)
  const re = /(?:^|\s)(?:[:@#][\w:.-]+|v-[\w:.-]+)\s*=\s*(["'])(.*?)\1/g
  let m
  while ((m = re.exec(line))) {
    if (inComment(m.index)) continue
    const start = m.index + m[0].length - m[2].length - 1
    const end = start + m[2].length
    const inner = maskRange(line, masked, start, end)
    const hit =
      findComma(line, [], inner) ||
      findCommaBefore(line, [], inner) ||
      findColon(line, [], inner, true) ||
      findArrow(line, [], inner, '=>')
    if (hit) return hit
  }
  return null
}

/** 单标签闭合的斜杠前应有一个空格：<input ... /> */
const findTagClose = (line, spans, masked) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== '/' || line[i + 1] !== '>') return null
    if (!line[i - 1] || /[ \t]/.test(line[i - 1])) return null
    return { start: i - 1, end: i + 2, message: '单标签闭合的斜杠前应有一个空格' }
  })

/** css 的选择器与花括号之间应有一个空格 */
const findCssBrace = (line, spans, masked) =>
  findCodeHit(line, spans, masked, (i) => {
    if (line[i] !== '{' || i === 0 || /[ \t]/.test(line[i - 1])) return null
    return { start: i - 1, end: i + 1, message: '选择器与花括号之间应有一个空格' }
  })

/** css 的声明末尾应有一个分号 */
const findCssSemicolon = (line, spans, masked) => {
  const trimmed = line.trim()
  if (!trimmed || /[{};,]$/.test(trimmed)) return null
  const hasColon = findCodeHit(line, spans, masked, (i) => line[i] === ':' && line[i + 1] !== ':')
  return hasColon ? { message: '声明末尾应有一个分号' } : null
}

/** 注释标记内侧的空白：行注释、#、<!-- -->、块注释四类标记 */
const checkCommentMarker = (line, span) => {
  const text = line.slice(span.start, span.end)
  const hits = []
  const after = (len, msg = '注释标记后应恰好一个空格') =>
    hits.push({ start: span.start, end: span.start + len, message: msg })
  if (text.startsWith('//')) {
    const rest = text.slice(2)
    if (rest.trim() && !/^ [^ ]/.test(rest)) after(2)
    return hits
  }
  if (text.startsWith('#')) {
    // #! 是 shebang，不是注释
    if (text.startsWith('#!')) return hits
    const rest = text.slice(1)
    if (rest.trim() && !/^ [^ ]/.test(rest)) after(1)
    return hits
  }
  if (text.startsWith('/*')) {
    // JSDoc 的额外星号属于标记本身，/*- 与 /*! 变体同样允许后接换行
    const open = /^\/\*[*!-]*/.exec(text)[0]
    const rest = text.slice(open.length)
    if (rest && !/^\s/.test(rest)) after(open.length)
  }
  if (text.startsWith('<!--')) {
    // 未在同一行闭合时无从判断尾部空格，只查开头
    const closed = text.endsWith('-->')
    const inner = closed ? text.slice(4, -3) : text.slice(4)
    if (inner.trim() && (!/^ /.test(inner) || (closed && !/ $/.test(inner)))) after(4)
    return hits
  }
  if (text.endsWith('*/')) {
    // 关闭标记前的星号属于标记本身，星号前仍要有空白
    let k = text.length - 3
    while (k >= 0 && text[k] === '*') k--
    if (k >= 0 && !/\s/.test(text[k])) {
      hits.push({ start: span.start + k, end: span.end, message: '注释标记前应恰好一个空格' })
    }
  }
  return hits
}

/** 日志里的冒号保持半角：与 comment-style.md 的例外一致 */
const isLogCall = (line, start) =>
  /(?:\bconsole|\blogger|\bLOGGER|\bLOG|\blog|System\.(?:out|err))\.\w+\([^)]*$/.test(line.slice(0, start))

/** 跨行扫描状态：块注释、字符串、vue 的 script/style 区间、块注释缩进 */
export const createCodeState = () => ({
  quote: null,
  quoteStart: 0,
  block: false,
  blockStart: 0,
  script: false,
  styleZone: false,
  blockCol: 0,
  blockChecked: true,
  blockStandalone: false,
  blockEmptyOpen: false
})

/** 逐行标记围栏与代码语言，散文行交给非代码块口径 */
export const parseContent = (content) => {
  const body = (content || '').replace(/\s+$/, '')
  if (!body) return { lines: [], flags: [] }
  const lines = body.split('\n')
  const flags = []
  let inFence = false
  let fenceChar = '`'
  let fenceLen = 0
  let style = 'none'
  let kind = 'other'
  let lang = ''

  for (const line of lines) {
    if (!inFence) {
      const open = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line)
      if (open) {
        inFence = true
        fenceChar = open[1][0]
        fenceLen = open[1].length
        lang = open[2] || ''
        style = codeStyle(lang)
        kind = codeKind(lang)
        flags.push({ type: 'fence-open', lang })
      } else {
        flags.push({ type: 'prose' })
      }
      continue
    }
    const closeRe = fenceChar === '`' ? /^ {0,3}(`{3,})\s*$/ : /^ {0,3}(~{3,})\s*$/
    const close = closeRe.exec(line)
    if (close && close[1].length >= fenceLen) {
      inFence = false
      flags.push({ type: 'fence-close' })
      continue
    }
    flags.push({ type: 'code', style, kind, lang })
  }
  return { lines, flags }
}

/** 代码行：代码标点、注释与字符串、注释里被注释掉的代码、块注释缩进 */
export const lintCodeLine = (line, lineNo, flag, state, out) => {
  // vue 按 <script> / <style> 区间分别套用 js 与 css 规则，模板里的属性冒号不误判
  let lineKind = flag.kind
  if (lineKind === 'vue') {
    if (/<script\b/.test(line)) state.script = true
    if (/<style\b/.test(line)) state.styleZone = true
    lineKind = state.script ? 'js' : state.styleZone ? 'css' : 'template'
    if (/<\/script>/.test(line)) state.script = false
    if (/<\/style>/.test(line)) state.styleZone = false
  }
  const continuingBlock = state.block
  const spans = scanCodeLine(line, flag.style, state)
  if (lineKind === 'js') {
    for (const [start, end] of regexRanges(line)) spans.push({ type: 'regex', start, end })
  }
  const masked = maskRanges(line, protectRanges(line))
  const doneRules = new Set()
  const emit = (hit, rule = 'punct') => {
    if (!hit || doneRules.has(hit.message)) return
    doneRules.add(hit.message)
    out.push(issue('content', 'error', rule, lineNo, hit.message, line, hit.start, hit.end))
  }
  // 单标签闭合不分语言，html / vue 模板 / jsx 都要查
  emit(findTagClose(line, spans, masked), 'tag')
  if (lineKind === 'template') emit(findTemplateAttrExpr(line, spans, masked))
  if ((flag.style === 'slash' || flag.style === 'hash' || flag.style === 'ahk') && lineKind !== 'template') {
    emit(findComma(line, spans, masked))
    emit(findCommaBefore(line, spans, masked))
    // 冒号只查 js 与 css；bash 的端口映射、yaml 的键值都不按这条算
    if (lineKind === 'js' || (lineKind === 'css' && !/[{,]$/.test(line.trim()))) {
      emit(findColon(line, spans, masked, true))
    }
    if (lineKind === 'js') {
      emit(findBraceSpace(line, spans, masked), 'brace')
      emit(findJsSemicolon(line, spans, masked), 'semicolon')
      emit(findTemplateExpr(line, spans, masked))
      emit(findArrow(line, spans, masked, '=>'))
    }
    if (/^java$/i.test(flag.lang || '')) emit(findArrow(line, spans, masked, '->'))
    if (lineKind === 'css') {
      emit(findCssBrace(line, spans, masked), 'brace')
      emit(findCssSemicolon(line, spans, masked), 'semicolon')
    }
  }
  let spacingDone = false
  let punctDone = false
  for (const span of spans) {
    if (span.type === 'comment') {
      const text = line.slice(span.start, span.end)
      // 独立成行且 /* 后直接换行的块注释，内容行才按缩进口径检查
      if (text.startsWith('/*') && !text.endsWith('*/')) {
        state.blockCol = span.start
        state.blockStandalone = /^\s*$/.test(line.slice(0, span.start))
        state.blockEmptyOpen = /^\s*$/.test(text.replace(/^\/\*[*!-]*/, ''))
        state.blockChecked = false
      }
      for (const mark of checkCommentMarker(line, span)) {
        out.push(issue('content', 'error', 'comment-space', lineNo, mark.message, line, mark.start, mark.end))
      }
      // 注释里被注释掉的代码与正常代码同一套规则，注释掉的标签也要查
      if (isCodeComment(line, span)) {
        const outer = maskOutside(line, masked, span.start, span.end)
        const inner = maskRange(line, masked, span.start, span.end)
        emit(findTagClose(line, [], inner), 'tag')
        if (isHtmlCommentCode(line, span)) {
          emit(findTemplateAttrExpr(line, [], outer))
        } else {
          emit(findComma(line, [], inner))
          emit(findCommaBefore(line, [], inner))
          emit(findColon(line, [], inner, lineKind === 'js' || lineKind === 'css'))
          if (lineKind === 'js') {
            emit(findBraceSpace(line, [], inner), 'brace')
            emit(findJsSemicolon(line, [], inner), 'semicolon')
            emit(findArrow(line, [], inner, '=>'))
          }
          if (/^java$/i.test(flag.lang || '')) emit(findArrow(line, [], inner, '->'))
        }
      }
    }
    if (!spacingDone) {
      const hit = findSpacing(line, span.start, span.end, masked)
      if (hit) {
        out.push(issue('content', 'error', 'spacing', lineNo, hit.message, line, hit.start, hit.end))
        spacingDone = true
      }
    }
    if (!punctDone) {
      const isLog = span.type === 'string' && isLogCall(line, span.start)
      const hit = findPunct(line, span.start, span.end, masked, isLog)
      if (hit) {
        out.push(issue('content', 'error', 'punct', lineNo, hit.message, line, hit.start, hit.end))
        punctDone = true
      }
    }
  }

  // 独立成行的块注释：内容与 /* 同级缩进，带星号的行星号与 * 对齐
  if (continuingBlock && state.blockStandalone && state.blockEmptyOpen && !state.blockChecked && line.trim()) {
    const indent = /^\s*/.exec(line)[0].length
    const t = line.trim()
    let ok = false
    let message = '块注释内容应与 /* 同级缩进'
    if (t.startsWith('*/')) {
      ok = indent === state.blockCol || indent === state.blockCol + 1
    } else if (t.startsWith('*')) {
      ok = indent === state.blockCol + 1
      message = '块注释的星号应与 /* 对齐'
    } else {
      ok = indent === state.blockCol
    }
    if (!ok) out.push(issue('content', 'error', 'indent', lineNo, message, line, 0, indent))
    state.blockChecked = true
  }
}

/** js 与 vue 代码块必须顶格，与仓内源文件风格一致 */
const FLUSH_LANGS = /^(js|javascript|vue)$/i

/** 代码行切注释、字符串与正则区间：缩进与结构判断共用 */
const scanLineSpans = (line, flag, state) => {
  const spans = scanCodeLine(line, flag.style, state)
  if (flag.kind === 'js') {
    for (const [start, end] of regexRanges(line)) spans.push({ type: 'regex', start, end })
  }
  return spans
}

/** 括号、方括号、花括号的总深度，用于判断一行是否属于顶层 */
const structDelta = (text) => {
  let d = 0
  for (const c of text) {
    if (c === '{' || c === '(' || c === '[') d++
    else if (c === '}' || c === ')' || c === ']') d--
  }
  return d
}

const VOID_TAGS = /^(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)$/i

/** vue 模板里的标签层级：自闭合与空元素不计层，标签可跨行 */
const tagDelta = (code, st) => {
  let d = 0
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (!st.inTag) {
      if (c === '<') {
        st.inTag = true
        st.buf = '<'
      }
      i++
      continue
    }
    if (c === '>') {
      const m = /^<\s*(\/?)\s*([A-Za-z][\w:-]*)/.exec(st.buf)
      if (m) {
        if (m[1] === '/') d--
        else if (!/\/\s*$/.test(st.buf) && !VOID_TAGS.test(m[2])) d++
      }
      st.inTag = false
      st.buf = ''
      i++
      continue
    }
    st.buf += c
    i++
  }
  return d
}

/** 顶层代码行必须顶格；块内、续行与 vue 模板的嵌套标签不判 */
export const lintFenceIndent = (lines, flags, out) => {
  for (let i = 0; i < lines.length; i++) {
    if (flags[i].type !== 'fence-open') continue
    let end = i + 1
    while (end < lines.length && flags[end].type === 'code') end++
    if (FLUSH_LANGS.test(flags[i].lang || '')) {
      const isVue = /^vue$/i.test(flags[i].lang || '')
      const state = createCodeState()
      let depth = 0
      let htmlDepth = 0
      let zone = 'template'
      const tagState = { inTag: false, buf: '' }
      let prevCode = ''
      for (let k = i + 1; k < end; k++) {
        const raw = lines[k]
        const code = codeOnly(raw, scanLineSpans(raw, flags[k], state))
        const trimmed = code.trim()
        const inMarkup = isVue && zone === 'template'
        if (!trimmed) {
          depth += structDelta(code)
          if (inMarkup) htmlDepth += tagDelta(code, tagState)
          continue
        }
        // 行首闭合符号决定该行实际属于哪一层，</ 也按一层闭合算
        let lead = 0
        while (lead < trimmed.length && ')]}'.includes(trimmed[lead])) lead++
        if (trimmed.startsWith('</')) lead++
        const effective = (inMarkup ? htmlDepth + depth : depth) - lead
        const indent = /^[ \t]*/.exec(raw)[0].length
        // 续行：本行以运算符开头，或上一行以运算符/开括号结尾（++/-- 是后缀，不算续行）
        const prevContinues = /(=>|[=+\-*/%&|?:,.([])$/.test(prevCode) && !/(\+\+|--)$/.test(prevCode)
        const continuation = /^[.\-+*/%&|?:]/.test(trimmed) || prevContinues
        if (effective <= 0 && indent > 0 && !continuation) {
          out.push(issue('content', 'error', 'indent', k + 1, '代码应顶格，行首不应有缩进', raw, 0, indent))
        }
        depth += structDelta(code)
        if (isVue) {
          if (zone === 'template') {
            htmlDepth += tagDelta(code, tagState)
            if (/<script\b/i.test(trimmed)) {
              zone = 'script'
              tagState.inTag = false
            } else if (/<style\b/i.test(trimmed)) {
              zone = 'style'
              tagState.inTag = false
            }
          } else if (zone === 'script' && /<\/script>/i.test(trimmed)) {
            zone = 'template'
            htmlDepth--
          } else if (zone === 'style' && /<\/style>/i.test(trimmed)) {
            zone = 'template'
            htmlDepth--
          }
        }
        prevCode = trimmed
      }
    }
    i = end
  }
}

/** class 块规则支持的语言 */
const CLASS_LANGS = /^(java|js|javascript|jsx|ts|typescript|tsx|ahk|autohotkey|ahkv2)$/i

/** 去掉注释与字符串后的代码文本，括号计数只认真正的代码 */
const codeOnly = (line, spans) => {
  if (!spans.length) return line
  const chars = line.split('')
  for (const s of spans) for (let i = s.start; i < s.end; i++) chars[i] = ' '
  return chars.join('')
}

const braceDelta = (text) => {
  let d = 0
  for (const c of text) {
    if (c === '{') d++
    else if (c === '}') d--
  }
  return d
}

const isClassDecl = (text) =>
  /^(?:(?:export|default|public|protected|private|final|abstract|sealed|static|strictfp)\s+)*class\s+[A-Za-z_$][\w$]*/i.test(
    text
  )

/** 类体成员：只有单个方法时 class { 后不空行，多个成员时空一行，class } 前不留空行 */
const reportClass = (lines, texts, deltas, start, open, close, out) => {
  const members = []
  let d = deltas[open]
  for (let j = open + 1; j < close; j++) {
    if (d === 1) {
      const t = texts[j].trim()
      if (t && !t.startsWith('@')) members.push(t.endsWith('{'))
    }
    d += deltas[j]
  }
  const methods = members.filter(Boolean).length
  const others = members.length - methods
  const next = open + 1
  if (next < close) {
    const nextBlank = isBlank(lines[start + next])
    if (methods === 1 && others === 0 && nextBlank) {
      out.push(issue('content', 'error', 'class', start + open + 1, '类体只有单个方法时，class { 后不应有空行', ''))
    }
    if (members.length >= 2 && !nextBlank) {
      out.push(issue('content', 'error', 'class', start + open + 1, 'class { 后应有一个空行', ''))
    }
  }
  if (close - 1 > open && isBlank(lines[start + close - 1])) {
    out.push(issue('content', 'error', 'class', start + close + 1, 'class } 前不应有空行', ''))
  }
}

const analyzeClassFence = (lines, flags, start, end, out) => {
  const state = createCodeState()
  const texts = []
  const deltas = []
  for (let k = start; k <= end; k++) {
    const text = codeOnly(lines[k], scanLineSpans(lines[k], flags[k], state))
    texts.push(text)
    deltas.push(braceDelta(text))
  }

  let depth = 0
  for (let k = start; k <= end; k++) {
    const text = texts[k - start]
    if (depth === 0 && text.includes('{') && isClassDecl(text.trim())) {
      const open = k - start
      let d = deltas[open]
      let close = null
      for (let j = open + 1; d > 0 && j < deltas.length; j++) {
        d += deltas[j]
        if (d <= 0) close = j
      }
      if (close !== null) {
        reportClass(lines, texts, deltas, start, open, close, out)
        k = start + close
        depth = 0
        continue
      }
    }
    depth += deltas[k - start]
  }
}

/** class 块规则：只分析围栏内顶层 class，按语言族区分 */
export const lintClassBlocks = (lines, flags, out) => {
  for (let i = 0; i < lines.length; i++) {
    if (flags[i].type !== 'fence-open') continue
    let end = i + 1
    while (end < lines.length && flags[end].type === 'code') end++
    if (CLASS_LANGS.test(flags[i].lang || '') && end > i + 1) {
      analyzeClassFence(lines, flags, i + 1, end - 1, out)
    }
    i = end
  }
}
