<template>
  <div class="text-paste glass-card">
    <input
      v-model="title"
      class="input text-paste__title"
      placeholder="标题（可选）"
    />
    <textarea
      v-model="content"
      class="input text-paste__content"
      placeholder="粘贴或输入文本内容..."
      rows="4"
    />
    <div class="text-paste__footer">
      <div class="text-paste__tags">
        <span v-for="tag in tags" :key="tag" class="tag">
          {{ tag }}
          <button class="tag__remove" @click="removeTag(tag)">×</button>
        </span>
        <input
          v-model="newTag"
          class="text-paste__tag-input"
          placeholder="添加标签..."
          @keydown.enter.prevent="addTag"
        />
      </div>
      <div class="text-paste__actions">
        <button class="btn-secondary text-paste__screenshot-btn" title="截图入库" @click="takeScreenshot">
          <CameraIcon />
          <span>截图</span>
        </button>
        <button
          class="btn-primary"
          :disabled="!content.trim() || saving"
          @click="save"
        >
          {{ saving ? '保存中...' : '存入知识库' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { h, ref } from 'vue'
import { useNotesStore } from '../stores/notes.js'

const notesStore = useNotesStore()

const title = ref('')
const content = ref('')
const tags = ref([])
const newTag = ref('')
const saving = ref(false)

// 截图图标
const CameraIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      h('circle', { cx: 12, cy: 13, r: 4 }),
    ])
  },
}

function takeScreenshot() {
  window.electronAPI?.takeScreenshot('full')
}

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
  }
  newTag.value = ''
}

function removeTag(tag) {
  tags.value = tags.value.filter(t => t !== tag)
}

async function save() {
  if (!content.value.trim()) return
  saving.value = true

  try {
    const result = await notesStore.saveNote({
      title: title.value.trim() || `文本笔记 ${new Date().toLocaleDateString('zh-CN')}`,
      content: content.value,
      type: 'text',
      tags: [...tags.value],
    })

    if (result?.success) {
      // 重置表单
      title.value = ''
      content.value = ''
      tags.value = []
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.text-paste {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.text-paste__title {
  font-size: 14px;
  font-weight: 500;
}

.text-paste__content {
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-sans);
  line-height: 1.6;
}

.text-paste__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
}

.text-paste__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.text-paste__screenshot-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  padding: 6px 12px;
  background: rgba(191, 90, 242, 0.08);
  border: 1px solid rgba(191, 90, 242, 0.25);
  color: var(--neon-purple-light);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.text-paste__screenshot-btn:hover {
  background: rgba(191, 90, 242, 0.18);
  border-color: var(--neon-purple);
}

.text-paste__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  flex: 1;
}

.text-paste__tag-input {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  width: 80px;
}

.text-paste__tag-input::placeholder {
  color: var(--text-muted);
}

.tag__remove {
  background: none;
  border: none;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.6;
}

.tag__remove:hover {
  opacity: 1;
}
</style>
