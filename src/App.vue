<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-body">
      <SideNav :currentPath="currentPath" @navigate="navigate" />
      <main class="app-content">
        <router-view v-if="hasRouter" />
        <div v-else class="placeholder">
          <h1>Knowledge Base Tools</h1>
          <p>赛博朋克知识库工具</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TitleBar from './components/TitleBar.vue'
import SideNav from './components/SideNav.vue'

const currentPath = ref('/')
const hasRouter = computed(() => false) // 待 Task 13 接入 router

function navigate(path) {
  currentPath.value = path
}
</script>

<style>
@import './styles/base.css';
@import './styles/components.css';
</style>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--space-md);
}

.placeholder h1 {
  color: var(--neon-cyan);
  font-size: 24px;
  font-weight: 600;
}

.placeholder p {
  color: var(--text-secondary);
}
</style>
