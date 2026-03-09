import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const loading = ref(false)

  function addNote(note) {
    notes.value.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: note.title || '未命名',
      content: note.content || '',
      type: note.type || 'text',
      tags: note.tags || [],
      source: note.source || '',
      createdAt: new Date().toISOString(),
      ...note,
    })
  }

  async function loadNotes() {
    loading.value = true
    try {
      const data = await window.electronAPI?.getNotes()
      if (data) notes.value = data
    } catch {
      // 非 Electron 环境
    } finally {
      loading.value = false
    }
  }

  // 监听主进程推送的刷新事件（忪Note 保存、HTTP clip 不就序刺激）
  function initListeners() {
    if (window.electronAPI?.onClipReceived) {
      window.electronAPI.onClipReceived(() => loadNotes())
    }
  }

  async function saveNote(note) {
    try {
      const result = await window.electronAPI?.saveNote(note)
      if (result?.success) {
        addNote(note)
      }
      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return { notes, loading, addNote, loadNotes, saveNote, initListeners }
})
