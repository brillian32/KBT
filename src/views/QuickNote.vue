<template>
  <div class="quick-note">
    <!-- 截图预览区 -->
    <div v-if="screenshotSrc" class="quick-note__preview">
      <img :src="screenshotSrc" alt="截图预览" class="quick-note__image" />
    </div>

    <!-- 类型选择 -->
    <div class="quick-note__type-bar">
      <button
        v-for="t in noteTypes"
        :key="t.value"
        class="quick-note__type-btn"
        :class="{ active: type === t.value }"
        @click="type = t.value"
      >
        <span class="quick-note__type-icon">{{ t.icon }}</span>
        {{ t.label }}
      </button>
    </div>

    <!-- 标题 -->
    <input
      v-model="title"
      class="input quick-note__title"
      placeholder="标题（可选）"
    />

    <!-- 内容输入 -->
    <textarea
      ref="contentRef"
      v-model="content"
      class="input quick-note__content"
      placeholder="记录你的想法..."
      rows="4"
    />

    <!-- 标签编辑 -->
    <TagEditor v-model="tags" placeholder="添加标签后回车..." />

    <!-- 操作按钮 -->
    <div class="quick-note__actions">
      <button class="btn-ghost" @click="cancel">取消</button>
      <button
        class="btn-primary"
        :disabled="!canSave || saving"
        @click="save"
      >
        {{ saving ? '保存中...' : '存入知识库' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TagEditor from '../components/TagEditor.vue'

const noteTypes = [
  { value: 'inspiration', label: '灵感', icon: '💡' },
  { value: 'todo', label: '待办', icon: '📋' },
  { value: 'note', label: '笔记', icon: '📝' },
]

const type = ref('note')
const title = ref('')
const content = ref('')
const tags = ref([])
const saving = ref(false)
const screenshotSrc = ref(null)
const contentRef = ref(null)

const canSave = computed(() => content.value.trim() || screenshotSrc.value)

onMounted(async () => {
  // 主动拉取待显示的截图（避免 did-finish-load 早于 Vue mounted 导致事件丢失）
  if (window.electronAPI?.getPendingScreenshot) {
    const data = await window.electronAPI.getPendingScreenshot()
    if (data?.base64) {
      screenshotSrc.value = `data:image/png;base64,${data.base64}`
    }
  }

  // 保留监听：用于窗口已存在时主进程推送新截图（如重复触发快捷键）
  if (window.electronAPI?.onScreenshotTaken) {
    window.electronAPI.onScreenshotTaken((data) => {
      if (data?.base64) {
        screenshotSrc.value = `data:image/png;base64,${data.base64}`
      }
    })
  }

  // 自动聚焦内容输入框
  contentRef.value?.focus()
})

async function save() {
  if (!canSave.value) return
  saving.value = true

  try {
    const note = {
      title: title.value.trim() || `${noteTypes.find(t => t.value === type.value)?.label || '笔记'} ${new Date().toLocaleDateString('zh-CN')}`,
      content: content.value,
      type: type.value,
      tags: [...tags.value],
    }

    // 如果有截图，附加 base64 数据
    if (screenshotSrc.value) {
      note.screenshot = screenshotSrc.value
    }

    if (window.electronAPI) {
      await window.electronAPI.saveNote(note)
    }

    // 保存成功后关闭窗口
    if (window.electronAPI) {
      window.electronAPI.closeWindow()
    }
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (window.electronAPI) {
    window.electronAPI.closeWindow()
  }
}
</script>

<style scoped>
.quick-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  height: 100vh;
  box-sizing: border-box;
  background: var(--bg-deep);
}

/* 截图预览 */
.quick-note__preview {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  max-height: 200px;
}

.quick-note__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* 类型选择器 */
.quick-note__type-bar {
  display: flex;
  gap: var(--space-xs);
}

.quick-note__type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-note__type-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.quick-note__type-btn.active {
  border-color: var(--neon-purple);
  color: var(--neon-purple-light);
  background: rgba(191, 90, 242, 0.08);
  box-shadow: var(--glow-purple);
}

.quick-note__type-icon {
  font-size: 16px;
}

/* 标题 */
.quick-note__title {
  font-size: 14px;
  font-weight: 500;
}

/* 内容 */
.quick-note__content {
  flex: 1;
  resize: none;
  font-family: var(--font-sans);
  line-height: 1.6;
  min-height: 80px;
}

/* 操作按钮 */
.quick-note__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border-default);
}
</style>
