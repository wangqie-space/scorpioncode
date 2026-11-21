<template>
  <!-- ===== 配置控件渲染 ===== -->
  <template v-if="item.type === 'switch'">
    <el-switch size="small" :model-value="item.get()" :disabled="isDisabled" @change="item.set" />
  </template>
  <template v-else-if="item.type === 'radio'">
    <el-radio-group :model-value="item.get()" :disabled="isDisabled" @change="item.set" size="small">
      <el-radio v-for="opt in item.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
    </el-radio-group>
  </template>
  <template v-else-if="item.type === 'number'">
    <el-input-number
      :model-value="item.get()"
      :min="item.min?.() ?? -Infinity"
      :max="item.max?.() ?? Infinity"
      :disabled="isDisabled"
      @change="item.set"
      size="small"
    />
  </template>
  <template v-else-if="item.type === 'tags'">
    <!-- 清除图标只在 hover 时出现，侧栏布局会因此多折一行，故不启用 clearable -->
    <el-input-tag
      :model-value="tagValues"
      placeholder="输入后回车添加"
      size="small"
      tag-type="primary"
      :disabled="isDisabled"
      class="config-tag-input"
      @change="handleTagChange"
    />
  </template>
</template>

<script setup>
// ============================================================
// 配置控件渲染 — 根据 item.type 渲染 switch / radio / number / tags
// ============================================================
import { computed } from 'vue'

const props = defineProps({
  /** @type {import('@/data/configItems').ConfigItem} */
  item: { type: Object, required: true }
})

// 依赖其他配置项的控件由 item.disabled() 给出禁用态
const isDisabled = computed(() => props.item.disabled?.() === true)

// tags 型配置项以逗号分隔字符串存储，控件内与数组互转
const tagValues = computed(() =>
  String(props.item.get() || '')
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)
)

const handleTagChange = (list) => props.item.set((list || []).join(','))
</script>

<style lang="scss" scoped>
.config-tag-input {
  width: 320px;

  // 标签超出三行时在控件内滚动，避免把卡片撑高
  :deep(.el-input-tag__inner) {
    max-height: 68px;
    overflow-y: auto;
  }
}
</style>

<style lang="scss">
// 关闭图标取 --el-tag-text-color，实心模式下与底色同色，须按 uiMode 单独指定
.ui-full .config-tag-input .el-tag .el-tag__close {
  color: var(--el-color-primary-text) !important;
}
.ui-full .config-tag-input .el-tag .el-tag__close:hover {
  background-color: var(--el-color-primary-light-3) !important;
}
.ui-plain .config-tag-input .el-tag .el-tag__close {
  color: var(--el-color-primary-plain) !important;
}
.ui-plain .config-tag-input .el-tag .el-tag__close:hover {
  color: var(--el-color-primary-text) !important;
  background-color: var(--el-color-primary) !important;
}
</style>
