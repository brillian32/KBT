# Knowledge Base Tools 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 构建一个 Electron + Vue3 桌面应用 + Chrome Extension，实现网页采集、文本入库、截图闪念笔记功能，数据存入 Obsidian 知识库。

**架构:** 单体 Electron 应用（主进程管理 HTTP 服务器、截图、Obsidian 写入），Vue3 渲染进程提供 UI，Chrome Extension 负责网页内容提取发送。

**技术栈:** Electron 33+, Vue 3, Vite, Pinia, Express, electron-store, turndown, Lucide Icons, Chrome Extension Manifest V3

---

## 阶段一：项目脚手架 & 基础框架

### Task 1: 初始化 Electron + Vue3 + Vite 项目

**文件:**
- 创建: `package.json`
- 创建: `vite.config.js`
- 创建: `electron/main.js`
- 创建: `src/main.js`
- 创建: `src/App.vue`
- 创建: `index.html`

**Step 1: 初始化 package.json 并安装依赖**

```bash
npm init -y
npm install vue pinia vue-router
npm install -D electron electron-builder vite @vitejs/plugin-vue concurrently wait-on
```

**Step 2: 创建 Vite 配置**

```js
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
  }
})
```

**Step 3: 创建 Electron 主进程入口**

```js
// electron/main.js
const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron')
const path = require('path')

let mainWindow = null
let tray = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框，自定义标题栏
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })
}

app.whenReady().then(createWindow)
```

**Step 4: 创建 Vue3 入口和 App.vue 骨架**

```js
// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

**Step 5: 配置 package.json scripts**

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && electron-builder"
  },
  "main": "electron/main.js"
}
```

**Step 6: 运行验证**

```bash
npm run dev
```
预期: Electron 窗口打开，显示 Vue3 应用。

**Step 7: 提交**

```bash
git add -A
git commit -m "feat(scaffold): 初始化 Electron + Vue3 + Vite 项目骨架"
```

---

### Task 2: 创建 preload.js 和 IPC 通信桥

**文件:**
- 创建: `electron/preload.js`

**Step 1: 编写测试 — 验证 preload API 暴露**

在 App.vue 中添加临时代码验证 `window.electronAPI` 存在。

**Step 2: 创建 preload.js**

```js
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // 配置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // 笔记操作
  saveNote: (note) => ipcRenderer.invoke('note:save', note),
  getNotes: () => ipcRenderer.invoke('notes:list'),

  // 截图
  takeScreenshot: (mode) => ipcRenderer.invoke('screenshot:take', mode),

  // 监听事件
  onScreenshotTaken: (callback) => ipcRenderer.on('screenshot:taken', (_, data) => callback(data)),
  onClipReceived: (callback) => ipcRenderer.on('clip:received', (_, data) => callback(data)),
})
```

**Step 3: 在 main.js 中注册 IPC handlers**

```js
// electron/main.js 中添加
const { ipcMain } = require('electron')

ipcMain.on('window:minimize', () => mainWindow.minimize())
ipcMain.on('window:maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => mainWindow.hide())
```

**Step 4: 运行验证**

启动应用，在 DevTools console 中执行 `window.electronAPI`，确认对象存在。

**Step 5: 提交**

```bash
git add -A
git commit -m "feat(ipc): 创建 preload.js 和 IPC 通信桥"
```

---

### Task 3: 配置持久化模块 (electron-store)

**文件:**
- 创建: `electron/config-store.js`
- 测试: `tests/config-store.test.js`

**Step 1: 安装依赖**

```bash
npm install electron-store
npm install -D vitest
```

**Step 2: 编写测试**

```js
// tests/config-store.test.js
import { describe, it, expect } from 'vitest'
// 测试默认配置结构是否正确
```

**Step 3: 实现 config-store.js**

```js
// electron/config-store.js
const Store = require('electron-store')

const schema = {
  obsidian: {
    type: 'object',
    properties: {
      vaultPath: { type: 'string', default: '' },
      apiUrl: { type: 'string', default: 'https://localhost:27124' },
      apiToken: { type: 'string', default: '' },
      useApi: { type: 'boolean', default: true },
    }
  },
  directories: {
    type: 'object',
    properties: {
      webClips: { type: 'string', default: 'Inbox/WebClips' },
      screenshots: { type: 'string', default: 'Inbox/Screenshots' },
      textNotes: { type: 'string', default: 'Inbox/TextNotes' },
      assets: { type: 'string', default: 'assets' },
    }
  },
  shortcuts: {
    type: 'object',
    properties: {
      screenshotFull: { type: 'string', default: 'Ctrl+Shift+K' },
      screenshotRegion: { type: 'string', default: 'Ctrl+Shift+A' },
    }
  },
  server: {
    type: 'object',
    properties: {
      port: { type: 'number', default: 18321 },
      token: { type: 'string', default: '' },
    }
  },
  frontmatter: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
    }
  },
  tagRules: {
    type: 'array',
    default: [
      { keywords: ['JavaScript', 'TypeScript', 'Node.js'], tags: ['JavaScript'], category: '编程/JavaScript' },
      { keywords: ['React', 'Vue', 'Angular'], tags: ['前端框架'], category: '编程/前端' },
      { keywords: ['Python', 'Django', 'Flask'], tags: ['Python'], category: '编程/Python' },
    ]
  }
}

const store = new Store({ schema })

module.exports = { store, schema }
```

**Step 4: 运行测试**

```bash
npx vitest run tests/config-store.test.js
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat(config): 实现配置持久化模块 (electron-store)"
```

---

## 阶段二：Obsidian 写入引擎

### Task 4: Obsidian REST API 写入

**文件:**
- 创建: `electron/obsidian-writer.js`
- 测试: `tests/obsidian-writer.test.js`

**Step 1: 编写测试 — API 写入笔记**

```js
// tests/obsidian-writer.test.js
import { describe, it, expect, vi } from 'vitest'
// mock fetch, 验证 API 调用参数正确
// 验证 fallback 到文件写入
```

**Step 2: 实现 obsidian-writer.js**

```js
// electron/obsidian-writer.js
const fs = require('fs').promises
const path = require('path')
const { store } = require('./config-store')

class ObsidianWriter {
  // checkApiAvailable() — 检测 REST API 是否可达
  // writeViaApi(note) — 通过 API 写入
  // writeViaFile(note) — 直接写文件系统
  // write(note) — 统一入口，API 优先 + fallback
  // saveImage(imageBuffer, filename) — 保存截图
}
```

**Step 3: 运行测试验证**

```bash
npx vitest run tests/obsidian-writer.test.js
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(obsidian): 实现 Obsidian 写入引擎（API + 文件 fallback）"
```

---

### Task 5: 自动标签 & Frontmatter 生成

**文件:**
- 创建: `electron/auto-tagger.js`
- 测试: `tests/auto-tagger.test.js`

**Step 1: 编写测试**

```js
// tests/auto-tagger.test.js
// 测试1: 含 "JavaScript" 的内容应命中 JavaScript 规则
// 测试2: 无匹配应返回 "未分类"
// 测试3: 多规则同时命中应合并标签
// 测试4: frontmatter 生成格式正确
```

**Step 2: 实现 auto-tagger.js**

```js
// electron/auto-tagger.js
class AutoTagger {
  constructor(rules) { this.rules = rules }
  // analyze(title, content) → { tags: [], category: '' }
  // generateFrontmatter(note) → YAML 字符串
}
```

**Step 3: 运行测试**

```bash
npx vitest run tests/auto-tagger.test.js
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(tagger): 实现自动标签和 Frontmatter 生成"
```

---

## 阶段三：本地 HTTP 服务器

### Task 6: Express HTTP 服务器

**文件:**
- 创建: `electron/http-server.js`
- 测试: `tests/http-server.test.js`

**Step 1: 安装依赖**

```bash
npm install express cors crypto
```

**Step 2: 编写测试**

```js
// tests/http-server.test.js
// 测试1: GET /api/ping 返回 200
// 测试2: POST /api/clip 不带 token 返回 401
// 测试3: POST /api/clip 带正确 token 返回 200
// 测试4: POST /api/text 保存文本内容
```

**Step 3: 实现 http-server.js**

```js
// electron/http-server.js
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')

class HttpServer {
  constructor(port, obsidianWriter, autoTagger) {
    this.app = express()
    this.token = crypto.randomBytes(32).toString('hex')
    // 设置中间件和路由
    // POST /api/clip
    // POST /api/text
    // GET /api/ping
    // GET /api/tags
  }
  start() { /* 启动监听 127.0.0.1 */ }
  stop() { /* 关闭 */ }
}
```

**Step 4: 运行测试**

```bash
npx vitest run tests/http-server.test.js
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat(server): 实现本地 HTTP 服务器（token 鉴权 + API 端点）"
```

---

## 阶段四：截图模块

### Task 7: 全屏截图

**文件:**
- 创建: `electron/screenshot.js`
- 测试: `tests/screenshot.test.js`

**Step 1: 编写测试**

```js
// 测试: 截图返回 Buffer，尺寸 > 0
```

**Step 2: 实现全屏截图**

```js
// electron/screenshot.js
const { desktopCapturer, screen } = require('electron')

class Screenshot {
  // captureFullScreen() → Buffer (PNG)
  // captureRegion(bounds) → Buffer (PNG)  ← Task 8
}
```

**Step 3: 运行测试 & 提交**

```bash
git add -A
git commit -m "feat(screenshot): 实现全屏截图功能"
```

---

### Task 8: 区域选择截图

**文件:**
- 修改: `electron/screenshot.js`
- 创建: `src/views/RegionSelect.vue`（透明窗口）

**Step 1: 创建透明全屏窗口用于区域选择**

- 全屏截图后创建透明 BrowserWindow
- 截图作为背景
- Vue 组件实现拖拽选区 overlay
- 选区完成后裁剪 PNG 并返回

**Step 2: 运行测试 & 提交**

```bash
git add -A
git commit -m "feat(screenshot): 实现区域选择截图"
```

---

## 阶段五：Vue3 UI 界面

### Task 9: 赛博朋克主题 CSS 变量和基础布局

**文件:**
- 创建: `src/styles/variables.css` — 色彩系统 CSS 变量
- 创建: `src/styles/base.css` — 全局重置和基础样式
- 创建: `src/styles/components.css` — 通用组件样式（卡片、按钮、输入框）
- 创建: `src/components/TitleBar.vue` — 自定义标题栏
- 创建: `src/components/SideNav.vue` — 侧边栏导航

**Step 1: 实现 CSS 变量系统**

所有颜色定义在 variables.css 中，参照设计文档 6.2 调色板。

**Step 2: 实现自定义标题栏**

无边框窗口 + TitleBar 组件（拖拽区域、最小化/最大化/关闭按钮）。

**Step 3: 实现侧边栏导航**

三个入口：收藏、截图、设置。使用 Lucide Icons。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(ui): 实现赛博朋克主题 CSS 和基础布局组件"
```

---

### Task 10: 主窗口 — 历史记录列表和快速文本入库

**文件:**
- 创建: `src/views/MainView.vue`
- 创建: `src/components/NoteCard.vue`
- 创建: `src/components/TextPasteInput.vue`
- 创建: `src/stores/notes.js`

**Step 1: 实现 NoteCard 组件**

玻璃质感卡片，显示标题、类型图标、标签、时间。

**Step 2: 实现 TextPasteInput 组件**

粘贴输入区 + 标题 + 标签编辑 + "存入知识库"按钮。

**Step 3: 实现 MainView**

上半部分历史记录列表，下半部分快速文本入库。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(ui): 实现主窗口历史记录和快速文本入库"
```

---

### Task 11: 闪念笔记弹窗（QuickNote）

**文件:**
- 创建: `src/views/QuickNote.vue`
- 创建: `src/components/TagEditor.vue`

**Step 1: 实现 QuickNote Vue 组件**

截图预览 + 文字输入 + 类型选择（灵感/待办/笔记） + 标签编辑 + 保存按钮。

**Step 2: 在 main.js 中创建 QuickNote 窗口**

截图完成后创建新的小窗口加载 QuickNote 路由。

**Step 3: 提交**

```bash
git add -A
git commit -m "feat(ui): 实现闪念笔记弹窗"
```

---

### Task 12: 设置页

**文件:**
- 创建: `src/views/SettingsView.vue`
- 创建: `src/stores/settings.js`

**Step 1: 实现设置页**

分区：Obsidian 连接、目录映射、快捷键、标签规则管理。

**Step 2: 实现 Pinia settings store**

与 electron-store 双向同步。

**Step 3: 提交**

```bash
git add -A
git commit -m "feat(ui): 实现设置页"
```

---

### Task 13: Vue Router 和页面整合

**文件:**
- 创建: `src/router/index.js`
- 修改: `src/main.js` — 注册 router
- 修改: `src/App.vue` — 使用 router-view

**Step 1: 配置路由**

```js
// / → MainView
// /settings → SettingsView
// /quick-note → QuickNote (独立窗口用)
```

**Step 2: 整合所有页面，运行验证**

**Step 3: 提交**

```bash
git add -A
git commit -m "feat(ui): 整合 Vue Router 和页面导航"
```

---

## 阶段六：系统托盘和全局快捷键

### Task 14: 系统托盘 + 快捷键注册

**文件:**
- 修改: `electron/main.js` — 添加托盘和快捷键逻辑

**Step 1: 实现系统托盘**

托盘菜单：显示主窗口、全屏截图、区域截图、退出。

**Step 2: 注册全局快捷键**

- `Ctrl+Shift+K` → 全屏截图 → 弹出 QuickNote
- `Ctrl+Shift+A` → 区域截图 → 弹出 QuickNote

**Step 3: 窗口关闭行为**

关闭按钮 → 隐藏到托盘（非退出）。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(tray): 实现系统托盘和全局快捷键"
```

---

## 阶段七：Chrome Extension

### Task 15: Extension 骨架 + Popup

**文件:**
- 创建: `chrome-extension/manifest.json`
- 创建: `chrome-extension/popup/popup.html`
- 创建: `chrome-extension/popup/popup.js`
- 创建: `chrome-extension/popup/popup.css`
- 创建: `chrome-extension/background/service-worker.js`

**Step 1: 创建 Manifest V3 配置**

**Step 2: 实现 Popup 界面**

三个按钮：保存整页、保存选中、元素检查。标题/标签编辑区。连接状态指示。赛博朋克风格。

**Step 3: 实现 Service Worker**

- 注册右键菜单 "保存到知识库"
- 与 Electron HTTP 服务器通信

**Step 4: 在 Chrome 加载扩展测试**

```
chrome://extensions → 加载已解压的扩展程序 → 选择 chrome-extension 目录
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat(extension): 创建 Chrome Extension 骨架和 Popup"
```

---

### Task 16: 内容提取器（Content Script）

**文件:**
- 创建: `chrome-extension/content/extractor.js`

**Step 1: 安装 Readability**

在 chrome-extension 中引入 @mozilla/readability 和 turndown 的浏览器版本。

**Step 2: 实现提取功能**

```js
// extractor.js
// extractFullPage() — Readability + Turndown
// extractSelection() — window.getSelection() HTML → Markdown
// startElementInspect() — 注入 overlay, 鼠标悬停高亮, 点击提取
```

**Step 3: 在真实网页上测试三种提取模式**

**Step 4: 提交**

```bash
git add -A
git commit -m "feat(extension): 实现网页内容提取器（整页/选中/元素检查）"
```

---

### Task 17: Extension 与 Electron 联调

**文件:**
- 修改: `chrome-extension/popup/popup.js` — 添加发送逻辑
- 修改: `chrome-extension/background/service-worker.js` — token 配对

**Step 1: 实现连接检测**

Popup 加载时 GET /api/ping 检测 Electron 运行状态。

**Step 2: 实现内容发送**

提取内容 → POST /api/clip → 显示成功/失败提示。

**Step 3: 实现 token 配对流程**

首次连接时，用户在 Electron 设置页获取 token，粘贴到 Extension popup 中保存。

**Step 4: 端到端测试**

网页 → 点击插件 → 保存整页 → 确认 Obsidian Vault 中生成了 .md 文件。

**Step 5: 提交**

```bash
git add -A
git commit -m "feat(extension): 完成 Extension 与 Electron 联调"
```

---

## 阶段八：集成测试 & 打包

### Task 18: 端到端集成测试

**文件:**
- 创建: `tests/e2e/` 目录

**Step 1: 测试场景**

1. 网页采集 → Obsidian 写入（API 和文件两条路径）
2. 文本粘贴 → 自动标签 → 保存
3. 截图 → QuickNote → 保存（.md + .png）
4. 设置修改 → 持久化 → 重启恢复

**Step 2: 提交**

```bash
git add -A
git commit -m "test(e2e): 添加端到端集成测试"
```

---

### Task 19: Electron Builder 打包配置

**文件:**
- 创建: `electron-builder.yml`
- 修改: `package.json` — 打包配置

**Step 1: 配置 electron-builder**

```yaml
# electron-builder.yml
appId: com.kbt.knowledge-base-tools
productName: Knowledge Base Tools
directories:
  output: release
win:
  target: nsis
  icon: assets/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

**Step 2: 构建打包**

```bash
npm run build
```

**Step 3: 验证安装包**

**Step 4: 提交**

```bash
git add -A
git commit -m "chore(build): 配置 Electron Builder 打包"
```

---

## 执行建议

建议按阶段顺序执行，每个 Task 完成一个 TDD 循环后立即提交。阶段之间可以做一次集成验证：

- **阶段一完成后**: 验证 Electron + Vue3 开发环境可用
- **阶段二+三完成后**: 用 curl/Postman 测试 HTTP → Obsidian 写入链路
- **阶段四+五完成后**: 验证截图 → QuickNote → 保存流程
- **阶段六完成后**: 验证全局快捷键和托盘功能
- **阶段七完成后**: 验证完整的网页采集端到端流程
