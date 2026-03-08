<template>
  <div
    class="region-select"
    @mousedown="startSelection"
    @mousemove="updateSelection"
    @mouseup="endSelection"
    @keydown.escape="cancel"
    tabindex="0"
    ref="container"
  >
    <!-- 截图背景 -->
    <img v-if="backgroundImage" :src="backgroundImage" class="background" />

    <!-- 暗色遮罩（选区外） -->
    <div class="overlay" />

    <!-- 选区框 -->
    <div
      v-if="selecting || hasSelection"
      class="selection-box"
      :style="selectionStyle"
    >
      <div class="size-label">{{ selectionWidth }} × {{ selectionHeight }}</div>
    </div>

    <!-- 提示文字 -->
    <div v-if="!selecting && !hasSelection" class="hint">
      拖拽选择区域，ESC 取消
    </div>

    <!-- 确认/取消按钮 -->
    <div v-if="hasSelection && !selecting" class="actions" :style="actionsStyle">
      <button class="btn confirm" @click="confirm">✓</button>
      <button class="btn cancel-btn" @click="cancel">✕</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const container = ref(null)
const backgroundImage = ref('')
const selecting = ref(false)
const hasSelection = ref(false)

const startX = ref(0)
const startY = ref(0)
const endX = ref(0)
const endY = ref(0)

const selectionWidth = computed(() => Math.abs(endX.value - startX.value))
const selectionHeight = computed(() => Math.abs(endY.value - startY.value))

const selectionStyle = computed(() => {
  const left = Math.min(startX.value, endX.value)
  const top = Math.min(startY.value, endY.value)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${selectionWidth.value}px`,
    height: `${selectionHeight.value}px`,
  }
})

const actionsStyle = computed(() => {
  const left = Math.min(startX.value, endX.value) + selectionWidth.value - 70
  const top = Math.min(startY.value, endY.value) + selectionHeight.value + 8
  return {
    left: `${Math.max(0, left)}px`,
    top: `${Math.min(window.innerHeight - 40, top)}px`,
  }
})

function startSelection(e) {
  selecting.value = true
  hasSelection.value = false
  startX.value = e.clientX
  startY.value = e.clientY
  endX.value = e.clientX
  endY.value = e.clientY
}

function updateSelection(e) {
  if (!selecting.value) return
  endX.value = e.clientX
  endY.value = e.clientY
}

function endSelection() {
  if (!selecting.value) return
  selecting.value = false
  if (selectionWidth.value > 10 && selectionHeight.value > 10) {
    hasSelection.value = true
  }
}

function confirm() {
  const bounds = {
    x: Math.min(startX.value, endX.value),
    y: Math.min(startY.value, endY.value),
    width: selectionWidth.value,
    height: selectionHeight.value,
  }
  window.electronAPI?.confirmRegion(bounds)
}

function cancel() {
  window.electronAPI?.cancelRegion()
}

onMounted(() => {
  container.value?.focus()
  // 通过 IPC 接收主进程发送的背景截图
  if (window.electronAPI?.onScreenshotBackdrop) {
    window.electronAPI.onScreenshotBackdrop((base64) => {
      backgroundImage.value = `data:image/png;base64,${base64}`
    })
  }
})
</script>

<style scoped>
.region-select {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  cursor: crosshair;
  user-select: none;
  outline: none;
}

.background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.selection-box {
  position: absolute;
  border: 2px solid var(--neon-cyan, #00F0FF);
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
  z-index: 10;
  pointer-events: none;
}

.size-label {
  position: absolute;
  top: -24px;
  left: 0;
  font-size: 12px;
  color: var(--neon-cyan, #00F0FF);
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  color: var(--neon-cyan, #00F0FF);
  background: rgba(0, 0, 0, 0.6);
  padding: 12px 24px;
  border-radius: 8px;
  pointer-events: none;
}

.actions {
  position: absolute;
  z-index: 20;
  display: flex;
  gap: 4px;
}

.btn {
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: white;
}

.confirm {
  background: var(--neon-cyan, #00F0FF);
  color: var(--bg-deep, #08080F);
}

.cancel-btn {
  background: var(--neon-magenta, #FF2E97);
  color: var(--bg-deep, #08080F);
}
</style>
