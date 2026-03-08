<template>
  <div class="settings">
    <h2 class="settings__title">设置</h2>

    <!-- Obsidian 连接 -->
    <section class="settings__section glass-card">
      <h3 class="settings__section-title">Obsidian 连接</h3>
      <div class="settings__field">
        <label class="settings__label">Vault 路径</label>
        <input
          v-model="store.settings.obsidian.vaultPath"
          class="input"
          placeholder="例如: D:/MyVault"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field">
        <label class="settings__label">API 地址</label>
        <input
          v-model="store.settings.obsidian.apiUrl"
          class="input"
          placeholder="https://localhost:27124"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field">
        <label class="settings__label">API Token</label>
        <input
          v-model="store.settings.obsidian.apiToken"
          class="input"
          type="password"
          placeholder="Obsidian Local REST API Token"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field settings__field--row">
        <label class="settings__label">优先使用 API 写入</label>
        <input
          v-model="store.settings.obsidian.useApi"
          type="checkbox"
          class="settings__checkbox"
          @change="store.saveSettings()"
        />
      </div>
    </section>

    <!-- 目录映射 -->
    <section class="settings__section glass-card">
      <h3 class="settings__section-title">目录映射</h3>
      <div class="settings__field">
        <label class="settings__label">网页剪藏</label>
        <input
          v-model="store.settings.directories.webClips"
          class="input"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field">
        <label class="settings__label">截图</label>
        <input
          v-model="store.settings.directories.screenshots"
          class="input"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field">
        <label class="settings__label">文本笔记</label>
        <input
          v-model="store.settings.directories.textNotes"
          class="input"
          @change="store.saveSettings()"
        />
      </div>
      <div class="settings__field">
        <label class="settings__label">附件目录</label>
        <input
          v-model="store.settings.directories.assets"
          class="input"
          @change="store.saveSettings()"
        />
      </div>
    </section>

    <!-- 快捷键 -->
    <section class="settings__section glass-card">
      <h3 class="settings__section-title">快捷键</h3>
      <div class="settings__field settings__field--row">
        <label class="settings__label">全屏截图</label>
        <span class="settings__shortcut">{{ store.settings.shortcuts.screenshotFull }}</span>
      </div>
      <div class="settings__field settings__field--row">
        <label class="settings__label">区域截图</label>
        <span class="settings__shortcut">{{ store.settings.shortcuts.screenshotRegion }}</span>
      </div>
    </section>

    <!-- HTTP 服务 -->
    <section class="settings__section glass-card">
      <h3 class="settings__section-title">HTTP 服务（Chrome 扩展通信）</h3>
      <div class="settings__field settings__field--row">
        <label class="settings__label">端口</label>
        <span class="settings__value">{{ store.settings.server.port }}</span>
      </div>
      <div class="settings__field">
        <label class="settings__label">Token</label>
        <div class="settings__token-row">
          <code class="settings__token">{{ tokenDisplay }}</code>
          <button class="btn-ghost" @click="toggleToken">
            {{ showToken ? '隐藏' : '显示' }}
          </button>
          <button class="btn-ghost" @click="copyToken">复制</button>
        </div>
      </div>
    </section>

    <!-- 标签规则 -->
    <section class="settings__section glass-card">
      <h3 class="settings__section-title">自动标签规则</h3>
      <div
        v-for="(rule, index) in store.settings.tagRules"
        :key="index"
        class="settings__rule"
      >
        <div class="settings__rule-header">
          <span class="settings__rule-label">规则 {{ index + 1 }}</span>
          <button class="btn-ghost settings__rule-delete" @click="removeRule(index)">删除</button>
        </div>
        <div class="settings__field">
          <label class="settings__label">关键词（逗号分隔）</label>
          <input
            :value="rule.keywords.join(', ')"
            class="input"
            @change="updateRuleKeywords(index, $event.target.value)"
          />
        </div>
        <div class="settings__field">
          <label class="settings__label">标签（逗号分隔）</label>
          <input
            :value="rule.tags.join(', ')"
            class="input"
            @change="updateRuleTags(index, $event.target.value)"
          />
        </div>
        <div class="settings__field">
          <label class="settings__label">分类</label>
          <input
            v-model="rule.category"
            class="input"
            @change="store.saveSettings()"
          />
        </div>
      </div>
      <button class="btn-ghost settings__add-rule" @click="addRule">+ 添加规则</button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings.js'

const store = useSettingsStore()
const showToken = ref(false)

const tokenDisplay = computed(() => {
  const token = store.settings.server.token
  if (!token) return '（未生成）'
  return showToken.value ? token : '••••••••••••••••'
})

onMounted(() => {
  store.loadSettings()
})

function toggleToken() {
  showToken.value = !showToken.value
}

async function copyToken() {
  const token = store.settings.server.token
  if (token) {
    await navigator.clipboard.writeText(token)
  }
}

function addRule() {
  store.settings.tagRules.push({
    keywords: [],
    tags: [],
    category: '',
  })
  store.saveSettings()
}

function removeRule(index) {
  store.settings.tagRules.splice(index, 1)
  store.saveSettings()
}

function updateRuleKeywords(index, value) {
  store.settings.tagRules[index].keywords = value.split(',').map(s => s.trim()).filter(Boolean)
  store.saveSettings()
}

function updateRuleTags(index, value) {
  store.settings.tagRules[index].tags = value.split(',').map(s => s.trim()).filter(Boolean)
  store.saveSettings()
}
</script>

<style scoped>
.settings {
  padding: var(--space-lg);
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.settings__title {
  color: var(--text-accent);
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.settings__section {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.settings__section-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 var(--space-xs) 0;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-default);
}

.settings__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.settings__label {
  color: var(--text-secondary);
  font-size: 12px;
}

.settings__checkbox {
  accent-color: var(--neon-cyan);
  width: 16px;
  height: 16px;
}

.settings__shortcut {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--neon-cyan);
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
}

.settings__value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
}

/* Token 行 */
.settings__token-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.settings__token {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 标签规则 */
.settings__rule {
  padding: var(--space-sm);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.settings__rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings__rule-label {
  color: var(--text-accent);
  font-size: 12px;
  font-weight: 600;
}

.settings__rule-delete {
  font-size: 12px;
  color: var(--error);
  padding: 2px 6px;
}

.settings__add-rule {
  align-self: flex-start;
  font-size: 13px;
}
</style>
