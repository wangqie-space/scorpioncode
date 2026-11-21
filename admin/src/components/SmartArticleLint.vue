<template>
  <el-dialog
    :model-value="modelValue"
    title="文章排版规范校验"
    width="clamp(480px, 45%, 92vw)"
    append-to-body
    class="article-lint-dialog"
    @update:model-value="handleVisibleChange"
  >
    <!-- ===== 摘要 ===== -->
    <p class="lint-summary">
      发现 <span class="lint-count lint-count-error">{{ result.errors.length }}</span> 个错误、<span
        class="lint-count lint-count-warning"
        >{{ result.warnings.length }}</span
      >
      个警告
    </p>

    <!-- ===== 条目列表 ===== -->
    <el-scrollbar max-height="50vh">
      <ul class="lint-list">
        <li v-for="(item, index) in visibleItems" :key="index" class="lint-item">
          <div class="lint-meta">
            <el-tag :type="item.level === 'error' ? 'danger' : 'warning'" size="small" effect="plain">
              {{ item.level === 'error' ? '错误' : '警告' }}
            </el-tag>
            <span class="lint-where">{{ whereText(item) }}</span>
            <span class="lint-message">{{ item.message }}</span>
          </div>
          <div v-if="item.hit || item.before || item.after" class="lint-code">
            <span>{{ item.before }}</span><span
              :class="item.level === 'error' ? 'lint-hit-error' : 'lint-hit-warning'"
              >{{ item.hit }}</span
            ><span>{{ item.after }}</span>
          </div>
        </li>
      </ul>
      <p v-if="restCount" class="lint-rest">另有 {{ restCount }} 处未列出</p>
    </el-scrollbar>

    <template #footer>
      <span class="dialog-footer">
        <el-button size="small" type="info" @click="handleCancel" plain>取消</el-button>
        <el-button size="small" type="primary" @click="handleConfirm" plain>继续</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

// ============================================================
// 数据
// ============================================================
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  /** lintArticle 的返回结果：{ errors, warnings, total } */
  result: {
    type: Object,
    default: () => ({ errors: [], warnings: [], total: 0 })
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

// 长文可能有上百条，超出只提示数量，避免弹窗无限长
const MAX_ITEMS = 100

// ============================================================
// 渲染
// ============================================================
const allItems = computed(() => [...props.result.errors, ...props.result.warnings])
const visibleItems = computed(() => allItems.value.slice(0, MAX_ITEMS))
const restCount = computed(() => Math.max(0, allItems.value.length - MAX_ITEMS))

/** 条目定位文案：标题或正文行号 */
const whereText = (item) => (item.field === 'title' ? '标题' : `正文第 ${item.line} 行`)

// ============================================================
// 方法
// ============================================================
const handleVisibleChange = (val) => emit('update:modelValue', val)

const handleCancel = () => {
  emit('update:modelValue', false)
  emit('cancel')
}

const handleConfirm = () => {
  emit('update:modelValue', false)
  emit('confirm')
}
</script>

<style scoped lang="scss">
.lint-summary {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);

  .lint-count {
    font-weight: 600;
  }

  .lint-count-error {
    color: var(--el-color-danger);
  }

  .lint-count-warning {
    color: var(--el-color-warning);
  }
}

.lint-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lint-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.lint-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.lint-where {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.lint-message {
  color: var(--el-text-color-primary);
}

// 命中片段：保留原空格，红/黄只标在命中的几个字符上
.lint-code {
  margin-top: 6px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  color: var(--el-text-color-regular);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  word-break: break-all;
  white-space: pre-wrap;

  .lint-hit-error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
    font-weight: 600;
  }

  .lint-hit-warning {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
    font-weight: 600;
  }
}

.lint-rest {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

<style lang="scss">
.article-lint-dialog .el-dialog__title {
  font-size: 16px !important;
}
</style>
