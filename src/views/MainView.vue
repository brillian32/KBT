<template>
  <div class="main-view">
    <!-- 快速文本入库 -->
    <section class="main-view__input-section">
      <h2 class="section-title">快速入库</h2>
      <TextPasteInput />
    </section>

    <!-- 历史记录 -->
    <section class="main-view__history">
      <h2 class="section-title">最近笔记</h2>
      <div v-if="notesStore.notes.length === 0" class="empty-state">
        <p>暂无笔记记录</p>
        <p class="empty-hint">通过上方输入框或 Chrome 扩展保存内容</p>
      </div>
      <div v-else class="notes-list">
        <NoteCard
          v-for="note in notesStore.notes"
          :key="note.id"
          :note="note"
          @click="openNote"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '../stores/notes.js'
import NoteCard from '../components/NoteCard.vue'
import TextPasteInput from '../components/TextPasteInput.vue'

const notesStore = useNotesStore()
const router = useRouter()

onMounted(() => {
  notesStore.loadNotes()
  notesStore.initListeners()
})

function openNote(note) {
  if (note.path && window.electronAPI?.openNoteInObsidian) {
    window.electronAPI.openNoteInObsidian(note.path)
  } else {
    router.push({ name: 'note-detail', params: { id: note.id } })
  }
}
</script>

<style scoped>
.main-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 720px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--space-md);
}

.main-view__history {
  flex: 1;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  color: var(--text-muted);
  font-size: 14px;
}

.empty-hint {
  font-size: 12px;
}
</style>
