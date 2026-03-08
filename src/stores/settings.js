import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive({
    obsidian: {
      vaultPath: '',
      apiUrl: 'https://localhost:27124',
      apiToken: '',
      useApi: true,
    },
    directories: {
      webClips: 'Inbox/WebClips',
      screenshots: 'Inbox/Screenshots',
      textNotes: 'Inbox/TextNotes',
      assets: 'assets',
    },
    shortcuts: {
      screenshotFull: 'Ctrl+Shift+K',
      screenshotRegion: 'Ctrl+Shift+A',
    },
    server: {
      port: 18321,
      token: '',
    },
    frontmatter: {
      enabled: true,
    },
    tagRules: [],
  })

  const loaded = ref(false)

  async function loadSettings() {
    if (!window.electronAPI) return
    try {
      const data = await window.electronAPI.getSettings()
      if (data) {
        Object.assign(settings, data)
      }
      loaded.value = true
    } catch {
      // 加载失败使用默认值
    }
  }

  async function saveSettings() {
    if (!window.electronAPI) return
    await window.electronAPI.saveSettings(JSON.parse(JSON.stringify(settings)))
  }

  async function updateField(key, value) {
    // 支持嵌套路径如 'obsidian.vaultPath'
    const parts = key.split('.')
    let obj = settings
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]]
    }
    obj[parts[parts.length - 1]] = value
    await saveSettings()
  }

  return { settings, loaded, loadSettings, saveSettings, updateField }
})
