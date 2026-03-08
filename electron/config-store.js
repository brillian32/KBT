const fs = require('fs')
const path = require('path')

const defaultConfig = {
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
  tagRules: [
    { keywords: ['JavaScript', 'TypeScript', 'Node.js'], tags: ['JavaScript'], category: '编程/JavaScript' },
    { keywords: ['React', 'Vue', 'Angular'], tags: ['前端框架'], category: '编程/前端' },
    { keywords: ['Python', 'Django', 'Flask'], tags: ['Python'], category: '编程/Python' },
  ],
}

class ConfigStore {
  constructor(configPath) {
    this._path = configPath
    this._data = this._load()
  }

  _load() {
    try {
      if (fs.existsSync(this._path)) {
        const raw = fs.readFileSync(this._path, 'utf-8')
        return this._merge(defaultConfig, JSON.parse(raw))
      }
    } catch {
      // 配置文件损坏则使用默认值
    }
    return JSON.parse(JSON.stringify(defaultConfig))
  }

  _merge(defaults, overrides) {
    const result = JSON.parse(JSON.stringify(defaults))
    for (const [key, val] of Object.entries(overrides)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object') {
        result[key] = this._merge(result[key], val)
      } else {
        result[key] = val
      }
    }
    return result
  }

  get(key) {
    const parts = key.split('.')
    let val = this._data
    for (const p of parts) {
      if (val === undefined || val === null) return undefined
      val = val[p]
    }
    return val
  }

  set(key, value) {
    const parts = key.split('.')
    let obj = this._data
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = {}
      }
      obj = obj[parts[i]]
    }
    obj[parts[parts.length - 1]] = value
    this._save()
  }

  getAll() {
    return JSON.parse(JSON.stringify(this._data))
  }

  _save() {
    const dir = path.dirname(this._path)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2), 'utf-8')
  }
}

function createConfigStore(configPath) {
  return new ConfigStore(configPath)
}

module.exports = { ConfigStore, createConfigStore, defaultConfig }

