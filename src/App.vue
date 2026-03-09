<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-body">
      <SideNav v-if="!isStandalone" :currentPath="currentRoute" @navigate="navigate" />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TitleBar from './components/TitleBar.vue'
import SideNav from './components/SideNav.vue'

const router = useRouter()
const route = useRoute()
const currentRoute = computed(() => route.path)

const standaloneRoutes = ['/quick-note', '/region-select']
const isStandalone = computed(() => standaloneRoutes.includes(route.path))

function navigate(path) {
  router.push(path)
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
