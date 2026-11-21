import { ref, onMounted, onUnmounted } from 'vue'

/** 表格高度安全余量（px）：吸收亚像素舍入，避免页面刚好溢出 */
const TABLE_HEIGHT_GUTTER = 4

/** 表格兜底最小高度（px）：视口过矮时表格不至于被压没 */
const TABLE_MIN_HEIGHT = 200

/**
 * 列表页表格自动高度
 *
 * 按实测尺寸扣除表格上下的占位，取整后保证页面永不溢出；页面一旦溢出，
 * 滚轮滚的就是外层页面，表格会停在亚像素位置导致内容重绘抖动。
 *
 * 搜索区按表格顶边实测偏移计算，折叠面板与普通搜索行都适用；
 * 面板展开为动画过渡（高度逐帧变化），用 ResizeObserver 跟随重算。
 *
 * @returns {{ tableMaxHeight: import('vue').Ref<string> }} 绑定到 el-table 的 max-height
 */
export function useTableAutoHeight() {
  const tableMaxHeight = ref('500')
  let collapseObserver = null
  let retryTimers = []

  /** 重新计算表格可用高度 */
  const recalcTableHeight = () => {
    const wrap = document.querySelector('.main-scrollbar > .el-scrollbar__wrap')
    const view = wrap?.querySelector(':scope > .el-scrollbar__view')
    const table = document.querySelector('.main-scrollbar .el-table')
    if (!wrap || !view || !table) return
    const wrapRect = wrap.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    // 上方取表格顶边偏移，下方取内容底部到表格底部的占位（分页 / 留白）
    const above = tableRect.top - wrapRect.top + wrap.scrollTop
    const below = view.getBoundingClientRect().bottom - tableRect.bottom
    const avail = wrap.clientHeight - above - below - TABLE_HEIGHT_GUTTER
    tableMaxHeight.value = `${Math.max(Math.floor(avail), TABLE_MIN_HEIGHT)}px`
  }

  onMounted(() => {
    recalcTableHeight()
    window.addEventListener('resize', recalcTableHeight)
    const collapse = document.querySelector('.search-collapse')
    if (collapse && typeof ResizeObserver !== 'undefined') {
      collapseObserver = new ResizeObserver(() => requestAnimationFrame(recalcTableHeight))
      collapseObserver.observe(collapse)
    }
    // 表格与分页是异步渲染的，挂载初期分页可能尚未占位（高度为 0），
    // 会让表格被算高一个分页的量，延时补算兜底
    retryTimers = [50, 200, 600, 1500].map((delay) => setTimeout(recalcTableHeight, delay))
  })

  onUnmounted(() => {
    window.removeEventListener('resize', recalcTableHeight)
    collapseObserver?.disconnect()
    retryTimers.forEach(clearTimeout)
  })

  return { tableMaxHeight }
}
