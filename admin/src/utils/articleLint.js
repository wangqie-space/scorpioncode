// 非代码块口径与文档级规则：散文标点、断行 R1–R7、空行、标题；对外暴露 lintArticle

import { isBlank, maskRanges, mergeRanges, protectRanges, findSpacing, findPunct, issue } from './articleLintShared'
import {
  inlineCodeRanges,
  findCodeGap,
  createCodeState,
  parseContent,
  lintCodeLine,
  lintClassBlocks,
  lintFenceIndent
} from './articleLintCode'

/** 散文区里属于代码的部分：行内代码、链接目标、HTML 标签 */
const proseRanges = (line) => {
  const ranges = [...protectRanges(line), ...inlineCodeRanges(line)]
  for (const m of line.matchAll(/\]\([^)\n]*\)/g)) ranges.push([m.index + 1, m.index + m[0].length])
  for (const m of line.matchAll(/<\/?[A-Za-z][^>]*>/g)) ranges.push([m.index, m.index + m[0].length])
  return mergeRanges(ranges)
}

/** 正文：散文查措辞与行内代码两侧空格，代码块交代码口径，断行查 R1~R7 */
const scanContent = (content, out) => {
  const { lines, flags } = parseContent(content)
  if (!lines.length) return
  const state = createCodeState()

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const flag = flags[idx]
    const lineNo = idx + 1
    if (flag.type === 'prose') {
      const masked = maskRanges(line, proseRanges(line))
      const spacing = findSpacing(line, 0, line.length, masked)
      if (spacing)
        out.push(issue('content', 'error', 'spacing', lineNo, spacing.message, line, spacing.start, spacing.end))
      const punct = findPunct(line, 0, line.length, masked, false)
      if (punct) out.push(issue('content', 'error', 'punct', lineNo, punct.message, line, punct.start, punct.end))
      const gap = findCodeGap(line, inlineCodeRanges(line))
      if (gap) out.push(issue('content', 'error', 'spacing', lineNo, gap.message, line, gap.start, gap.end))
      continue
    }
    if (flag.type !== 'code') continue
    lintCodeLine(line, lineNo, flag, state, out)
  }

  // 整段代码块的规则：js/vue 顶格、class 块的空行位置，都按围栏单独扫
  lintFenceIndent(lines, flags, out)
  lintClassBlocks(lines, flags, out)

  // 断行：标题、代码块、表格、引言、图片前后各一个空行 — 相邻元素共用一个空行，按边界去重
  const gaps = new Set()
  const addGap = (a, b) => {
    if (a >= 0 && b < lines.length && b === a + 1) gaps.add(a)
  }
  const isTableHeader = (idx) => {
    if (flags[idx].type !== 'prose' || !lines[idx].includes('|')) return false
    const next = lines[idx + 1]
    return !!next && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(next)
  }
  // 引言块：> 开头的连续行，只在块的首尾要求空行
  const isQuote = (idx) => idx >= 0 && idx < lines.length && flags[idx].type === 'prose' && /^ {0,3}>/.test(lines[idx])
  // 单独成行的图片：图片是行内元素，独占一行时按块级元素处理
  const isImage = (idx) =>
    idx >= 0 && idx < lines.length && flags[idx].type === 'prose' && /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(lines[idx])
  for (let idx = 0; idx < lines.length; idx++) {
    const isHeading = flags[idx].type === 'prose' && /^ {0,3}#{1,6}\s/.test(lines[idx])
    const isHeader = isTableHeader(idx)
    if (isHeading || isHeader || flags[idx].type === 'fence-open') addGap(idx - 1, idx)
    if (isHeading || flags[idx].type === 'fence-close') addGap(idx, idx + 1)
    if (isHeader) {
      let j = idx + 1
      while (j < lines.length && flags[j].type === 'prose' && lines[j].includes('|') && !isBlank(lines[j])) j++
      addGap(j - 1, j)
    }
    if (isQuote(idx)) {
      if (!isQuote(idx - 1)) addGap(idx - 1, idx)
      if (!isQuote(idx + 1)) addGap(idx, idx + 1)
    }
    if (isImage(idx)) {
      addGap(idx - 1, idx)
      addGap(idx, idx + 1)
    }
  }
  for (const g of [...gaps].sort((a, b) => a - b)) {
    if (isBlank(lines[g]) || isBlank(lines[g + 1])) continue
    const message = `第 ${g + 1} 行与第 ${g + 2} 行之间应有一个空行`
    out.push(issue('content', 'error', 'blank', g + 2, message, ''))
  }

  // 空行里不应有空格，制表符同样算
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    if (line && isBlank(line)) {
      out.push(issue('content', 'error', 'blank', idx + 1, '空行不应包含空格', line, 0, line.length))
    }
  }

  // 围栏外连续 2 行及以上空行折叠为 1 行
  let start = -1
  for (let idx = 0; idx <= lines.length; idx++) {
    const blank = idx < lines.length && flags[idx].type === 'prose' && isBlank(lines[idx])
    if (blank && start === -1) start = idx
    if (!blank && start !== -1) {
      const count = idx - start
      if (count >= 2) {
        out.push(issue('content', 'error', 'blank', start + 1, `连续 ${count} 行空行应折叠为一行`, ''))
      }
      start = -1
    }
  }
}

export const lintArticle = ({ title, content, titleCaseWhitelist = '' }) => {
  const errors = []
  const warnings = []
  const text = title || ''
  const masked = maskRanges(text, protectRanges(text))
  const spacing = findSpacing(text, 0, text.length, masked)
  if (spacing) errors.push(issue('title', 'error', 'spacing', 1, spacing.message, text, spacing.start, spacing.end))
  const punct = findPunct(text, 0, text.length, masked, false)
  if (punct) errors.push(issue('title', 'error', 'punct', 1, punct.message, text, punct.start, punct.end))
  // 白名单内的词大小写固定，跳过首字母警告；值兼容逗号分隔字符串与数组
  const allow = new Set(
    String(titleCaseWhitelist || '')
      .split(',')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  )
  // 标题里每个英文单词的首字母都要大写，单词之间任何符号都算分隔
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)) {
    if (!/^[a-z]/.test(m[0])) continue
    if (allow.has(m[0].toLowerCase())) continue
    const at = m.index
    const message = `英文单词「${m[0]}」建议首字母大写`
    warnings.push(issue('title', 'warning', 'lowercase', 1, message, text, at, at + m[0].length))
  }

  const contentIssues = []
  scanContent(content, contentIssues)
  contentIssues.sort((a, b) => a.line - b.line)
  for (const item of contentIssues) {
    if (item.level === 'warning') warnings.push(item)
    else errors.push(item)
  }
  return { errors, warnings, total: errors.length + warnings.length }
}

/** 断行 R5：末尾恰好一个换行，提交时静默补齐 */
export const normalizeContentTail = (content) => {
  const text = (content || '').replace(/\s+$/, '')
  return text ? text + '\n' : ''
}
