<template>
  <div class="note-detail">
    <!-- 顶部导航栏 -->
    <div class="note-detail__bar">
      <button class="note-detail__back" @click="$router.back()">
        <BackIcon />
        <span>返回</span>
      </button>
      <span class="note-detail__type-badge" :class="`note-detail__type-badge--${note?.type}`">
        {{ typeLabel }}
      </span>
    </div>

    <div v-if="note" class="note-detail__body">
      <!-- 标题 -->
      <h1 class="note-detail__title">{{ note.title }}</h1>

      <!-- 元信息 -->
      <div class="note-detail__meta">
        <span class="note-detail__time">{{ formattedTime }}</span>
        <a v-if="note.source" :href="note.source" class="note-detail__source" target="_blank" @click.prevent="openSource">
          {{ note.source }}
        </a>
      </div>

      <!-- 标签 -->
      <div v-if="note.tags?.length" class="note-detail__tags">
        <span v-for="tag in note.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <!-- 截图内容 -->
      <div v-if="note.type === 'screenshot'" class="note-detail__screenshot">
        <img v-if="imageData" :src="imageData" alt="截图" class="note-detail__img" />
        <div v-else class="note-detail__img-placeholder">{{ imageLoadError || '图片加载中...' }}</div>
      </div>

      <!-- 文本/网页剪藏内容 -->
      <div v-else-if="note.content" class="note-detail__content glass-card">
        <pre class="note-detail__text">{{ note.content }}</pre>
      </div>

      <div v-else class="note-detail__empty">暂无内容</div>
    </div>

    <div v-else class="note-detail__not-found">
      <p>笔记不存在或已被删除</p>
      <button class="btn-primary" @click="$router.back()">返回</button>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore } from '../stores/notes.js'

const route = useRoute()
const notesStore = useNotesStore()

const note = computed(() => {
  return notesStore.notes.find(n => n.id === route.params.id) || null
})

onMounted(async () => {
  if (notesStore.notes.length === 0) {
    await notesStore.loadNotes()
  }
})

// 图片加载（通过 IPC，避免 http origin 无法访问 file://）
const imageData = ref(null)
const imageLoadError = ref('')

watch(note, async (newNote) => {
  imageData.value = null
  imageLoadError.value = ''
  if (newNote?.type === 'screenshot' && newNote.imagePath && window.electronAPI?.readImage) {
    const result = await window.electronAPI.readImage(newNote.imagePath)
    if (result?.success) {
      imageData.value = result.data
    } else {
      imageLoadError.value = result?.error || '图片加载失败'
    }
  }
}, { immediate: true })

const typeLabel = computed(() => {
  const map = {
    screenshot: '截图',
    webClip: '网页剪藏',
    text: '文本笔记',
    inspiration: '灵感',
    todo: '待办',
    note: '笔记',
  }
  return map[note.value?.type] || '笔记'
})

const formattedTime = computed(() => {
  if (!note.value?.createdAt) return ''
  const date = new Date(note.value.createdAt)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
})

function openSource() {
  if (note.value?.source) {
    window.electronAPI?.openExternal?.(note.value.source)
  }
}

// 返回按钮图标
const BackIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5 }, [
      h('polyline', { points: '15 18 9 12 15 6' }),
    ])
  },
}
</script>

<style scoped>
.note-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 720px;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 顶栏 */
.note-detail__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.note-detail__back {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: var(--space-xs) 0;
  transition: color 0.15s;
}
.note-detail__back:hover {
  color: var(--neon-cyan);
}

.note-detail__type-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.5px;
  background: rgba(255,255,255,0.05);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.note-detail__type-badge--screenshot { color: var(--neon-purple); border-color: var(--neon-purple); }
.note-detail__type-badge--webClip    { color: var(--neon-cyan);   border-color: var(--neon-cyan); }
.note-detail__type-badge--text       { color: var(--text-secondary); }
.note-detail__type-badge--inspiration { color: var(--neon-yellow); border-color: var(--neon-yellow); }
.note-detail__type-badge--todo        { color: var(--success);     border-color: var(--success); }
.note-detail__type-badge--note        { color: var(--neon-cyan);   border-color: var(--neon-cyan); }

/* 主体 */
.note-detail__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.note-detail__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  margin: 0;
}

.note-detail__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
}

.note-detail__time {
  font-size: 12px;
  color: var(--text-muted);
}

.note-detail__source {
  font-size: 12px;
  color: var(--neon-cyan);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
  cursor: pointer;
}
.note-detail__source:hover {
  text-decoration: underline;
}

.note-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

/* 截图 */
.note-detail__screenshot {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  min-height: 80px;
}
.note-detail__img {
  width: 100%;
  display: block;
}
.note-detail__img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  color: var(--text-muted);
  font-size: 13px;
}

/* 文本内容 */
.note-detail__content {
  padding: var(--space-md);
}
.note-detail__text {
  font-family: var(--font-sans, system-ui);
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* 空/404 */
.note-detail__empty,
.note-detail__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--text-muted);
  font-size: 14px;
}
</style>
