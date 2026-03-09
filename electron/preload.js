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
  readImage: (imgPath) => ipcRenderer.invoke('note:read-image', imgPath),
  openNoteInObsidian: (notePath) => ipcRenderer.invoke('note:open-in-obsidian', notePath),

  // 截图
  takeScreenshot: (mode) => ipcRenderer.invoke('screenshot:take', mode),
  getPendingScreenshot: () => ipcRenderer.invoke('screenshot:get-pending'),
  confirmRegion: (bounds) => ipcRenderer.invoke('region:confirm', bounds),
  cancelRegion: () => ipcRenderer.invoke('region:cancel'),  getRegionBackdrop: () => ipcRenderer.invoke('region:get-backdrop'),
  // 闪念笔记
  openQuickNote: (data) => ipcRenderer.invoke('quicknote:open', data),

  // 监听事件
  onScreenshotTaken: (callback) => {
    ipcRenderer.on('screenshot:taken', (_event, data) => callback(data))
  },
  onScreenshotBackdrop: (callback) => {
    ipcRenderer.on('screenshot:backdrop', (_event, base64) => callback(base64))
  },
  onClipReceived: (callback) => {
    ipcRenderer.on('clip:received', (_event, data) => callback(data))
  },
  onScreenshotRequest: (callback) => {
    ipcRenderer.on('screenshot:request', (_event, mode) => callback(mode))
  },
})
