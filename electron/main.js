const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow = null
let quickNoteWindow = null

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
    e.preventDefault()
    mainWindow.hide()
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

  // 加载完成后发送截图数据
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { createQuickNoteWindow }
