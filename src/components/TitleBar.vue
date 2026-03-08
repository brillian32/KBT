<template>
  <div class="titlebar" @dblclick="toggleMaximize">
    <div class="titlebar__drag">
      <span class="titlebar__title">Knowledge Base Tools</span>
    </div>
    <div class="titlebar__actions">
      <button class="titlebar__btn" @click="minimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg>
      </button>
      <button class="titlebar__btn" @click="toggleMaximize" title="最大化">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </button>
      <button class="titlebar__btn titlebar__btn--close" @click="close" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.5"/>
          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
function minimize() {
  window.electronAPI?.minimizeWindow()
}

function toggleMaximize() {
  window.electronAPI?.maximizeWindow()
}

function close() {
  window.electronAPI?.closeWindow()
}
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  height: var(--titlebar-height);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-default);
  user-select: none;
  -webkit-app-region: drag;
}

.titlebar__drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: var(--space-md);
}

.titlebar__title {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.titlebar__actions {
  display: flex;
  -webkit-app-region: no-drag;
}

.titlebar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: var(--titlebar-height);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.titlebar__btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.titlebar__btn--close:hover {
  background: var(--error);
  color: white;
}
</style>
