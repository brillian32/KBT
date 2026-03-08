const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage } = require('electron')
const path = require('path')
const { ConfigStore } = require('./config-store')
const { ObsidianWriter } = require('./obsidian-writer')
const { AutoTagger } = require('./auto-tagger')
const { HttpServer } = require('./http-server')
const { Screenshot } = require('./screenshot')

let mainWindow = null
let quickNoteWindow = null
let tray = null

// 后端模块实例
let configStore = null
let obsidianWriter = null
let autoTagger = null
let httpServer = null
let screenshot = null

// 历史笔记列表（内存缓存，持久化到配置目录）
const fs = require('fs')
let notesHistoryPath = ''
let notesHistory = []

function loadNotesHistory() {
  try {
    if (fs.existsSync(notesHistoryPath)) {
      notesHistory = JSON.parse(fs.readFileSync(notesHistoryPath, 'utf-8'))
    }
  } catch {
    notesHistory = []
  }
}

function saveNotesHistory() {
  const dir = path.dirname(notesHistoryPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(notesHistoryPath, JSON.stringify(notesHistory, null, 2), 'utf-8')
}

function initBackendModules() {
  const userDataPath = app.getPath('userData')
  const configPath = path.join(userDataPath, 'config.json')
  notesHistoryPath = path.join(userDataPath, 'notes-history.json')

  // 配置
  configStore = new ConfigStore(configPath)

  // 历史记录
  loadNotesHistory()

  // Obsidian 写入器
  const config = configStore.getAll()
  obsidianWriter = new ObsidianWriter({
    vaultPath: config.obsidian.vaultPath,
    apiUrl: config.obsidian.apiUrl,
    apiToken: config.obsidian.apiToken,
    useApi: config.obsidian.useApi,
    directories: config.directories,
  })

  // 自动标签
  autoTagger = new AutoTagger(config.tagRules)

  // 截图
  screenshot = new Screenshot()

  // HTTP 服务器
  httpServer = new HttpServer(config.server.port, obsidianWriter, autoTagger)

  // 将 token 写回配置
  configStore.set('server.token', httpServer.getToken())

  // 收到 clip 时通知渲染进程
  httpServer.onClip((data) => {
    // 添加到历史
    addNoteToHistory(data)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clip:received', data)
    }
  })

  httpServer.start().catch((err) => {
    console.error('HTTP 服务器启动失败:', err.message)
  })
}

function addNoteToHistory(note) {
  notesHistory.unshift({
    id: Date.now().toString(),
    title: note.title,
    type: note.type,
    tags: note.customTags || note.tags || [],
    preview: (note.content || '').slice(0, 200),
    createdAt: new Date().toISOString(),
    path: note.result?.path || '',
  })
  // 最多保留 500 条
  if (notesHistory.length > 500) notesHistory.length = 500
  saveNotesHistory()
}

function refreshWriter() {
  const config = configStore.getAll()
  obsidianWriter = new ObsidianWriter({
    vaultPath: config.obsidian.vaultPath,
    apiUrl: config.obsidian.apiUrl,
    apiToken: config.obsidian.apiToken,
    useApi: config.obsidian.useApi,
    directories: config.directories,
  })
  autoTagger = new AutoTagger(config.tagRules)
}

function getLoadURL(hash = '') {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:5173${hash ? '#' + hash : ''}`
  }
  return null
}

function getLoadFile() {
  return path.join(__dirname, '../dist/index.html')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  const devURL = getLoadURL()
  if (devURL) {
    mainWindow.loadURL(devURL)
  } else {
    mainWindow.loadFile(getLoadFile())
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createQuickNoteWindow(screenshotData) {
  if (quickNoteWindow && !quickNoteWindow.isDestroyed()) {
    quickNoteWindow.focus()
    if (screenshotData) {
      quickNoteWindow.webContents.send('screenshot:taken', screenshotData)
    }
    return quickNoteWindow
  }

  quickNoteWindow = new BrowserWindow({
    width: 480,
    height: 560,
    resizable: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  const devURL = getLoadURL('/quick-note')
  if (devURL) {
    quickNoteWindow.loadURL(devURL)
  } else {
    quickNoteWindow.loadFile(getLoadFile(), { hash: '/quick-note' })
  }

  quickNoteWindow.webContents.once('did-finish-load', () => {
    if (screenshotData) {
      quickNoteWindow.webContents.send('screenshot:taken', screenshotData)
    }
  })

  quickNoteWindow.on('closed', () => {
    quickNoteWindow = null
  })

  return quickNoteWindow
}

// 系统托盘
function createTray() {
  // 创建 16x16 简单图标（纯色方块）
  const icon = nativeImage.createFromBuffer(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2P8z8DwnwEPYMQnT4waoQaQbAA+Q0g2gBgX0A0geRDRDSB5GJFsAKWJiGQDKE1FRBsAAGgiJhFu/LekAAAAAElFTkSuQmCC', 'base64')
  )

  tray = new Tray(icon)
  tray.setToolTip('Knowledge Base Tools')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '全屏截图',
      accelerator: 'Ctrl+Shift+K',
      click: () => handleScreenshot('full'),
    },
    {
      label: '区域截图',
      accelerator: 'Ctrl+Shift+A',
      click: () => handleScreenshot('region'),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// 全局快捷键
function registerGlobalShortcuts() {
  globalShortcut.register('Ctrl+Shift+K', () => handleScreenshot('full'))
  globalShortcut.register('Ctrl+Shift+A', () => handleScreenshot('region'))
}

// 截图处理（快捷键/托盘触发）
function handleScreenshot(mode) {
  // 将截图请求发送到主窗口处理，完成后弹出 QuickNote
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('screenshot:request', mode)
  }
}

// IPC handlers — 窗口控制
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize()
  }
})
ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win === mainWindow) {
    mainWindow.hide()
  } else {
    win?.close()
  }
})

// IPC handler — 打开 QuickNote
ipcMain.handle('quicknote:open', (_event, screenshotData) => {
  createQuickNoteWindow(screenshotData)
})

// IPC handlers — 配置
ipcMain.handle('settings:get', () => {
  return configStore.getAll()
})

ipcMain.handle('settings:save', (_event, settings) => {
  // 逐个顶级 key 写入
  for (const [key, val] of Object.entries(settings)) {
    configStore.set(key, val)
  }
  // 刷新后端模块以应用新配置
  refreshWriter()
  return { success: true }
})

// IPC handlers — 笔记操作
ipcMain.handle('note:save', async (_event, note) => {
  try {
    // 处理截图数据
    if (note.screenshot) {
      const base64Data = note.screenshot.replace(/^data:image\/\w+;base64,/, '')
      const imgBuffer = Buffer.from(base64Data, 'base64')
      const config = configStore.getAll()
      const imgFilename = `screenshot_${Date.now()}.png`
      const imgDir = path.join(config.obsidian.vaultPath, config.directories.assets)
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true })
      const imgPath = path.join(imgDir, imgFilename)
      fs.writeFileSync(imgPath, imgBuffer)
      // 在内容中嵌入图片引用
      note.content = `![[${config.directories.assets}/${imgFilename}]]\n\n${note.content || ''}`
      delete note.screenshot
    }

    // 自动标签
    const frontmatter = autoTagger.generateFrontmatter({
      title: note.title,
      content: note.content,
      type: note.type,
      customTags: note.tags,
    })

    const writeNote = {
      title: note.title,
      content: note.content,
      type: note.type || 'text',
      customTags: note.tags || [],
      frontmatter,
    }

    const result = await obsidianWriter.write(writeNote)

    // 添加到历史
    addNoteToHistory({ ...writeNote, result })

    return { success: true, path: result.path }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('notes:list', () => {
  return notesHistory
})

// IPC handler — 截图
ipcMain.handle('screenshot:take', async (_event, mode) => {
  try {
    let buffer
    if (mode === 'full') {
      buffer = await screenshot.captureFullScreen()
    } else if (mode === 'region') {
      // 先全屏截图，然后在渲染进程选区后裁剪
      buffer = await screenshot.captureFullScreen()
    } else {
      throw new Error(`未知截图模式: ${mode}`)
    }
    const base64 = buffer.toString('base64')
    return { base64, mode }
  } catch (err) {
    return { error: err.message }
  }
})

app.whenReady().then(() => {
  initBackendModules()
  createWindow()
  createTray()
  registerGlobalShortcuts()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { createQuickNoteWindow }
