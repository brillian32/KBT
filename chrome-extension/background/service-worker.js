// service-worker.js — Chrome Extension Background Script

const API_BASE = 'http://127.0.0.1:18321'

// 注册右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'kbt-save-page',
    title: '保存整页到知识库',
    contexts: ['page'],
  })

  chrome.contextMenus.create({
    id: 'kbt-save-selection',
    title: '保存选中内容到知识库',
    contexts: ['selection'],
  })
})

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  if (info.menuItemId === 'kbt-save-page') {
    await clipFromTab(tab, 'full')
  } else if (info.menuItemId === 'kbt-save-selection') {
    await clipFromTab(tab, 'selection')
  }
})

// 监听来自 content script 的元素检查结果
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'inspectResult' && msg.content) {
    // 元素检查完成，发送到 Electron
    sendToElectron({
      title: msg.title || '元素提取',
      content: msg.content,
      url: msg.url || sender.tab?.url,
      type: 'webclip',
      tags: [],
    })
  }
})

async function clipFromTab(tab, mode) {
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'extract', mode })
    if (!result?.content) return

    await sendToElectron({
      title: tab.title || '未命名',
      content: result.content,
      url: tab.url,
      type: 'webclip',
      tags: [],
    })
  } catch {
    // 静默失败
  }
}

async function sendToElectron(data) {
  const stored = await chrome.storage.local.get(['kbt_token'])
  const token = stored.kbt_token || ''

  const resp = await fetch(`${API_BASE}/api/clip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  return resp.ok
}
