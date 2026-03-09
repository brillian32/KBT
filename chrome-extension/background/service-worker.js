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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'inspectResult' && msg.content) {
    // 元素检查完成，发送到 Electron
    // 必须 return true 并调用 sendResponse，才能让 Service Worker 保持活跃直至 fetch 完成
    sendToElectron({
      title: msg.title || '元素提取',
      content: msg.content,
      url: msg.url || sender.tab?.url,
      type: 'webclip',
      tags: [],
    }).then(ok => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: ok ? '✅ 保存成功' : '❌ 保存失败',
        message: ok
          ? `已保存「${msg.title || '元素内容'}」到知识库`
          : '无法连接到桌面端，请检查 KBT 是否运行',
        priority: 1,
      })
      sendResponse({ ok })
    }).catch(err => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '❌ 保存失败',
        message: err.message || '网络错误',
        priority: 1,
      })
      sendResponse({ ok: false })
    })
    return true  // 保持消息通道开放，防止 Service Worker 提前终止
  }
})

// 向 tab 发送消息，如果 content script 未注入则先动态注入再重试
async function sendToContentScript(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg)
  } catch (err) {
    if (err.message && err.message.includes('Receiving end does not exist')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/extractor.js'],
      })
      await new Promise(r => setTimeout(r, 150))
      return await chrome.tabs.sendMessage(tabId, msg)
    }
    throw err
  }
}

async function clipFromTab(tab, mode) {
  try {
    const result = await sendToContentScript(tab.id, { action: 'extract', mode })
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
