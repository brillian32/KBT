// popup.js — Chrome Extension Popup 脚本
;(async function () {
  const API_BASE = 'http://127.0.0.1:18321'

  // DOM 元素
  const statusEl = document.getElementById('status')
  const statusText = document.getElementById('statusText')
  const btnFullPage = document.getElementById('btnFullPage')
  const btnSelection = document.getElementById('btnSelection')
  const btnInspect = document.getElementById('btnInspect')
  const btnSettings = document.getElementById('btnSettings')
  const noteTitle = document.getElementById('noteTitle')
  const tagContainer = document.getElementById('tagContainer')
  const tagInput = document.getElementById('tagInput')
  const tokenSection = document.getElementById('tokenSection')
  const tokenStatus = document.getElementById('tokenStatus')
  const tokenInput = document.getElementById('tokenInput')
  const btnSaveToken = document.getElementById('btnSaveToken')
  const messageEl = document.getElementById('message')

  let token = ''
  const tags = []

  // 初始化
  await init()

  async function init() {
    // 加载保存的 token
    const stored = await chrome.storage.local.get(['kbt_token'])
    token = stored.kbt_token || ''

    // 自动提取页面标题
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.title) {
        noteTitle.value = tab.title
      }
    } catch {
      // 忽略
    }

    // 检测连接
    await checkConnection()
  }

  async function checkConnection() {
    try {
      const resp = await fetch(`${API_BASE}/api/ping`, {
        signal: AbortSignal.timeout(3000),
      })
      if (resp.ok) {
        setStatus('connected', '已连接')
        if (token) {
          enableButtons(true)
        } else {
          enableButtons(false)
          // 无 token 时自动展开设置抽屉
          openSettings()
        }
      } else {
        throw new Error('not ok')
      }
    } catch {
      setStatus('disconnected', token ? '桌面端未运行' : '未连接')
      enableButtons(false)
      if (!token) openSettings()
    }
  }

  // 齿轮按钒切换 token 抽屉
  function openSettings() {
    tokenSection.style.display = ''
    btnSettings.classList.add('active')
    renderTokenStatus()
  }

  function closeSettings() {
    tokenSection.style.display = 'none'
    btnSettings.classList.remove('active')
  }

  function renderTokenStatus() {
    if (token) {
      tokenStatus.innerHTML = `状态：<span class="kbt-bound">✅ 已绑定</span> <span class="kbt-token-mask">${token.slice(0, 8)}&hellip;</span> <button id="btnClearToken" class="popup__link-btn">解除绑定</button>`
      document.getElementById('btnClearToken')?.addEventListener('click', async () => {
        token = ''
        await chrome.storage.local.remove('kbt_token')
        renderTokenStatus()
        enableButtons(false)
        showMessage('Token 已清除', 'success')
      })
    } else {
      tokenStatus.innerHTML = `状态：<span class="kbt-unbound">⚠️ 未绑定</span>`
    }
  }

  btnSettings.addEventListener('click', () => {
    if (tokenSection.style.display === 'none') {
      openSettings()
    } else {
      closeSettings()
    }
  })

  function setStatus(state, text) {
    statusEl.className = `popup__status popup__status--${state}`
    statusText.textContent = text
  }

  function enableButtons(enabled) {
    btnFullPage.disabled = !enabled
    btnSelection.disabled = !enabled
    btnInspect.disabled = !enabled
  }

  // 标签管理
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const tag = tagInput.value.trim()
      if (tag && !tags.includes(tag)) {
        tags.push(tag)
        renderTags()
      }
      tagInput.value = ''
    }
  })

  function renderTags() {
    // 移除已有标签 DOM（保留 input）
    tagContainer.querySelectorAll('.popup__tag').forEach((el) => el.remove())
    tags.forEach((tag) => {
      const span = document.createElement('span')
      span.className = 'popup__tag'
      span.textContent = tag

      const removeBtn = document.createElement('button')
      removeBtn.className = 'popup__tag-remove'
      removeBtn.textContent = '×'
      removeBtn.addEventListener('click', () => {
        const idx = tags.indexOf(tag)
        if (idx > -1) tags.splice(idx, 1)
        renderTags()
      })

      span.appendChild(removeBtn)
      tagContainer.insertBefore(span, tagInput)
    })
  }

  // Token 保存
  btnSaveToken.addEventListener('click', async () => {
    const val = tokenInput.value.trim()
    if (!val) return
    token = val
    tokenInput.value = ''
    await chrome.storage.local.set({ kbt_token: val })
    renderTokenStatus()
    showMessage('Token 已绑定，重新检测连接...', 'success')
    await checkConnection()
    // 绑定成功后自动收起设置抽屉
    if (token) closeSettings()
  })

  // 保存操作
  btnFullPage.addEventListener('click', () => clipPage('full'))
  btnSelection.addEventListener('click', () => clipPage('selection'))
  btnInspect.addEventListener('click', () => startInspect())

  // 向 tab 发送消息，如果 content script 未注入则先动态注入再重试
  async function sendToContentScript(tabId, msg) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg)
    } catch (err) {
      if (err.message && err.message.includes('Receiving end does not exist')) {
        // 动态注入 content script 后重试
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/extractor.js'],
        })
        // 等待 content script 初始化
        await new Promise(r => setTimeout(r, 150))
        return await chrome.tabs.sendMessage(tabId, msg)
      }
      throw err
    }
  }

  async function clipPage(mode) {
    enableButtons(false)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // 浏览器内部页面无法注入 content script
      if (!tab?.url || /^(chrome|edge|about|data):/.test(tab.url)) {
        showMessage('当前页面不支持提取内容', 'error')
        return
      }

      // 向 content script 发送提取请求（带自动注入重试）
      const result = await sendToContentScript(tab.id, { action: 'extract', mode })

      if (!result?.content) {
        showMessage('未能提取内容', 'error')
        return
      }

      // 发送到 Electron
      const resp = await fetch(`${API_BASE}/api/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: noteTitle.value || tab.title,
          content: result.content,
          url: tab.url,
          type: 'webclip',
          tags,
        }),
      })

      if (resp.ok) {
        showMessage('保存成功！', 'success')
      } else {
        const data = await resp.json().catch(() => ({}))
        showMessage(data.error || '保存失败', 'error')
      }
    } catch (err) {
      showMessage(`错误：${err.message}`, 'error')
    } finally {
      enableButtons(true)
    }
  }

  async function startInspect() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.url || /^(chrome|edge|about|data):/.test(tab.url)) {
        showMessage('当前页面不支持元素检查', 'error')
        return
      }
      await sendToContentScript(tab.id, { action: 'inspect' })
      // 关闭 popup，用户在页面上操作
      window.close()
    } catch (err) {
      showMessage(`错误：${err.message}`, 'error')
    }
  }

  function showMessage(text, type) {
    messageEl.textContent = text
    messageEl.className = `popup__message popup__message--${type}`
    messageEl.style.display = ''
    setTimeout(() => {
      messageEl.style.display = 'none'
    }, 3000)
  }
})()
