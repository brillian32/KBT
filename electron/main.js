const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage } = require('electron')
const path = require('path')
const { ConfigStore } = require('./config-store')
const { ObsidianWriter } = require('./obsidian-writer')
const { AutoTagger } = require('./auto-tagger')
const { HttpServer } = require('./http-server')
const { Screenshot } = require('./screenshot')

let mainWindow = null
let quickNoteWindow = null
let regionSelectWindow = null
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
    // 窗口已存在：Vue 已 mounted，直接推送即可
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

  // 将截图数据挂在窗口上，供渲染进程在 onMounted 后主动拉取
  // 避免 did-finish-load 时 Vue 尚未 mounted 导致推送事件丢失
  quickNoteWindow._pendingScreenshot = screenshotData || null

  const devURL = getLoadURL('/quick-note')
  if (devURL) {
    quickNoteWindow.loadURL(devURL)
  } else {
    quickNoteWindow.loadFile(getLoadFile(), { hash: '/quick-note' })
  }

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

// 截图处理（快捷键/托盘触发）— 直接在主进程完成，不依赖渲染进程
async function handleScreenshot(mode) {
  try {
    const buffer = await screenshot.captureFullScreen()
    const base64 = buffer.toString('base64')

    if (mode === 'full') {
      createQuickNoteWindow({ base64, mode: 'full' })
    } else if (mode === 'region') {
      createRegionSelectWindow(base64)
    }
  } catch (err) {
    console.error('截图失败:', err.message)
  }
}

// 区域选择覆盖窗口
function createRegionSelectWindow(screenshotBase64) {
  if (regionSelectWindow && !regionSelectWindow.isDestroyed()) {
    regionSelectWindow.close()
  }

  const { screen } = require('electron')
  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.bounds

  regionSelectWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devURL = getLoadURL('/region-select')
  if (devURL) {
    regionSelectWindow.loadURL(devURL)
  } else {
    regionSelectWindow.loadFile(getLoadFile(), { hash: '/region-select' })
  }

  // 保存背景截图供渲染进程主动拉取（region:get-backdrop）
  regionSelectWindow._screenshotBase64 = screenshotBase64

  regionSelectWindow.on('closed', () => {
    regionSelectWindow = null
  })
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

// IPC handler — 截图（调用 handleScreenshot 以打开相应窗口）
ipcMain.handle('screenshot:take', async (_event, mode) => {
  try {
    await handleScreenshot(mode)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
})

// IPC handler — QuickNote 渲染进程主动拉取待显示的截图（避免时序问题）
ipcMain.handle('screenshot:get-pending', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const data = win?._pendingScreenshot || null
  if (win) win._pendingScreenshot = null  // 消费后清除
  return data
})

// IPC handler — 渲染进程主动拉取背景截图（避免 did-finish-load 时 Vue 尚未 mounted 的时序问题）
ipcMain.handle('region:get-backdrop', () => {
  return regionSelectWindow?._screenshotBase64 || null
})

// IPC handler — 区域选择确认
ipcMain.handle('region:confirm', (_event, bounds) => {
  if (!regionSelectWindow || regionSelectWindow.isDestroyed()) return { success: false }
  const base64 = regionSelectWindow._screenshotBase64
  regionSelectWindow.close()

  if (!base64) return { success: false }
  try {
    const { nativeImage, screen } = require('electron')
    const display = screen.getPrimaryDisplay()
    const scaleFactor = display.scaleFactor || 1

    const scaledBounds = {
      x: Math.round(bounds.x * scaleFactor),
      y: Math.round(bounds.y * scaleFactor),
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor),
    }

    const img = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
    const cropped = img.crop(scaledBounds)
    const croppedBase64 = cropped.toPNG().toString('base64')
    createQuickNoteWindow({ base64: croppedBase64, mode: 'region' })
    return { success: true }
  } catch (err) {
    console.error('裁剪截图失败:', err.message)
    return { success: false, error: err.message }
  }
})

// IPC handler — 区域选择取消
ipcMain.handle('region:cancel', () => {
  if (regionSelectWindow && !regionSelectWindow.isDestroyed()) {
    regionSelectWindow.close()
  }
  return { cancelled: true }
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
