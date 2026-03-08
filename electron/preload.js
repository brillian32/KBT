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

  // 闪念笔记
  openQuickNote: (data) => ipcRenderer.invoke('quicknote:open', data),

  // 监听事件
  onScreenshotTaken: (callback) => {
    ipcRenderer.on('screenshot:taken', (_event, data) => callback(data))
  },
  onClipReceived: (callback) => {
    ipcRenderer.on('clip:received', (_event, data) => callback(data))
  },
})
