<template>
  <div class="note-card glass-card" @click="$emit('click', note)">
    <div class="note-card__header">
      <span class="note-card__icon" :style="iconStyle">
        <component :is="typeIcon" />
      </span>
      <span class="note-card__title">{{ note.title }}</span>
      <span class="note-card__time">{{ relativeTime }}</span>
    </div>
    <div v-if="note.content" class="note-card__preview">
      {{ preview }}
    </div>
    <div v-if="note.tags?.length" class="note-card__tags">
      <span v-for="tag in note.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'

const props = defineProps({
  note: {
    type: Object,
    required: true,
  },
})

defineEmits(['click'])

const preview = computed(() => {
  const text = props.note.content.replace(/[#*`>\-\[\]]/g, '').trim()
  return text.length > 100 ? text.slice(0, 100) + '...' : text
})

const relativeTime = computed(() => {
  const date = new Date(props.note.createdAt)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
})

// 类型图标
const WebIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('line', { x1: 2, y1: 12, x2: 22, y2: 12 }),
      h('path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }),
    ])
  },
}

const TextIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
      h('polyline', { points: '14 2 14 8 20 8' }),
      h('line', { x1: 16, y1: 13, x2: 8, y2: 13 }),
      h('line', { x1: 16, y1: 17, x2: 8, y2: 17 }),
    ])
  },
}

const CameraIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      h('circle', { cx: 12, cy: 13, r: 4 }),
    ])
  },
}

const LightbulbIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M9 21h6' }),
      h('path', { d: 'M12 3a6 6 0 0 1 6 6c0 3.5-2 5.5-2 5.5H8S6 12.5 6 9a6 6 0 0 1 6-6z' }),
    ])
  },
}

const CheckIcon = {
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('polyline', { points: '9 11 12 14 22 4' }),
      h('path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }),
    ])
  },
}

const typeIcon = computed(() => {
  const map = {
    webClip: WebIcon,
    screenshot: CameraIcon,
    text: TextIcon,
    inspiration: LightbulbIcon,
    todo: CheckIcon,
    note: TextIcon,
  }
  return map[props.note.type] || TextIcon
})

const iconStyle = computed(() => {
  const colorMap = {
    webClip: 'var(--neon-cyan)',
    screenshot: 'var(--neon-purple)',
    text: 'var(--neon-cyan)',
    inspiration: 'var(--neon-yellow)',
    todo: 'var(--success)',
    note: 'var(--neon-cyan)',
  }
  return { color: colorMap[props.note.type] || 'var(--neon-cyan)' }
})
</script>

<style scoped>
.note-card {
  padding: var(--space-md);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.note-card:active {
  transform: scale(0.99);
}

.note-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.note-card__icon {
  display: flex;
  /* color 由 iconStyle 动态控制 */
}

.note-card__title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-card__time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.note-card__preview {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
</style>
