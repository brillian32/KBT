const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage } = require('electron')
const path = require('path')

let mainWindow = null
let quickNoteWindow = null
let tray = null

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

app.whenReady().then(() => {
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
