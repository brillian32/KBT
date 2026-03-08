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
      <button
        class="btn-primary"
        :disabled="!content.trim() || saving"
        @click="save"
      >
        {{ saving ? '保存中...' : '存入知识库' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNotesStore } from '../stores/notes.js'

const notesStore = useNotesStore()

const title = ref('')
const content = ref('')
const tags = ref([])
const newTag = ref('')
const saving = ref(false)

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
