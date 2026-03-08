<template>
  <nav class="sidenav">
    <div class="sidenav__top">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="sidenav__btn"
        :class="{ 'sidenav__btn--active': currentPath === item.path }"
        :title="item.label"
        @click="$emit('navigate', item.path)"
      >
        <component :is="item.icon" />
      </button>
    </div>
    <div class="sidenav__bottom">
      <button
        class="sidenav__btn"
        :class="{ 'sidenav__btn--active': currentPath === '/settings' }"
        title="设置"
        @click="$emit('navigate', '/settings')"
      >
        <SettingsIcon />
      </button>
    </div>
  </nav>
</template>

<script setup>
import { h } from 'vue'

defineProps({
  currentPath: {
    type: String,
    default: '/',
  },
})

defineEmits(['navigate'])

// 简单 SVG 图标组件
const BookmarkIcon = {
  render() {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }),
    ])
  },
}

const CameraIcon = {
  render() {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      h('circle', { cx: 12, cy: 13, r: 4 }),
    ])
  },
}

const InboxIcon = {
  render() {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('polyline', { points: '22 12 16 12 14 15 10 15 8 12 2 12' }),
      h('path', { d: 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }),
    ])
  },
}

const SettingsIcon = {
  render() {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }),
    ])
  },
}

const navItems = [
  { path: '/', label: '收藏', icon: InboxIcon },
  { path: '/capture', label: '截图', icon: CameraIcon },
]
</script>

<style scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-panel);
  border-right: 1px solid var(--border-default);
  padding: var(--space-sm) 0;
}

.sidenav__top,
.sidenav__bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.sidenav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidenav__btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.sidenav__btn--active {
  color: var(--neon-cyan);
  background: rgba(0, 240, 255, 0.08);
}

.sidenav__btn--active:hover {
  color: var(--neon-cyan);
}
</style>
