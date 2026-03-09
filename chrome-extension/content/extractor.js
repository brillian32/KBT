// extractor.js — Chrome Extension Content Script
// 网页内容提取器：整页/选中/元素检查三种模式

// 防止重复注入（动态 executeScript 可能多次调用）
if (window.__kbt_content_injected__) {
  // 已注入，什么都不做
} else {
window.__kbt_content_injected__ = true

;(function () {
  'use strict'

  let inspectOverlay = null
  let inspecting = false

  // 监听来自 popup / service-worker 的消息
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extract') {
      handleExtract(msg.mode).then(sendResponse)
      return true // 异步响应
    }
    if (msg.action === 'inspect') {
      startInspect(sendResponse)
      return true
    }
  })

  async function handleExtract(mode) {
    try {
      if (mode === 'full') {
        return extractFullPage()
      }
      if (mode === 'selection') {
        return extractSelection()
      }
      return { content: null, error: '未知模式' }
    } catch (err) {
      return { content: null, error: err.message }
    }
  }

  // 整页提取 — 使用 document.cloneNode 和简化清理
  function extractFullPage() {
    const docClone = document.cloneNode(true)

    // 移除脚本、样式、无关元素
    const removeSelectors = 'script, style, nav, footer, header, iframe, noscript, [role="banner"], [role="navigation"], [role="contentinfo"], .ad, .ads, .advertisement, .sidebar, .comments'
    docClone.querySelectorAll(removeSelectors).forEach((el) => el.remove())

    // 尝试提取主体内容
    const article = docClone.querySelector('article, [role="main"], main, .post-content, .article-content, .entry-content')
    const contentEl = article || docClone.body

    const markdown = htmlToMarkdown(contentEl)

    return {
      content: markdown,
      title: document.title,
      url: location.href,
    }
  }

  // 选中内容提取
  function extractSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return { content: null, error: '请先选中页面内容' }
    }

    const range = selection.getRangeAt(0)
    const container = document.createElement('div')
    container.appendChild(range.cloneContents())

    const markdown = htmlToMarkdown(container)

    return {
      content: markdown,
      title: document.title,
      url: location.href,
    }
  }

  // 页面内 Toast 通知
  function showPageToast(text, type = 'info') {
    const existing = document.getElementById('kbt-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'kbt-toast'
    const colors = {
      info:    { bg: 'rgba(0,240,255,0.12)',  border: '#00F0FF', text: '#00F0FF' },
      success: { bg: 'rgba(0,255,136,0.12)',  border: '#00FF88', text: '#00FF88' },
      error:   { bg: 'rgba(255,51,102,0.12)', border: '#FF3366', text: '#FF3366' },
    }
    const c = colors[type] || colors.info
    Object.assign(toast.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      padding: '10px 20px',
      borderRadius: '8px',
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: `0 0 16px ${c.border}44`,
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    })
    toast.textContent = text
    document.body.appendChild(toast)
    if (type !== 'info') {
      setTimeout(() => toast.remove(), 3000)
    }
    return toast
  }

  // 元素检查模式 — 鼠标悬停高亮，点击提取
  function startInspect(sendResponse) {
    if (inspecting) {
      stopInspect()
      if (sendResponse) sendResponse({ content: null })
      return
    }

    inspecting = true

    // 创建高亮 overlay
    inspectOverlay = document.createElement('div')
    inspectOverlay.id = 'kbt-inspect-overlay'
    Object.assign(inspectOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2px solid #00F0FF',
      background: 'rgba(0, 240, 255, 0.1)',
      zIndex: '2147483646',
      transition: 'all 100ms',
      display: 'none',
    })
    document.body.appendChild(inspectOverlay)

    // 顶部引导 Toast
    showPageToast('🔍 KBT 检查模式 — 点击要保存的元素，ESC 退出', 'info')

    let hoveredEl = null

    function onMouseMove(e) {
      hoveredEl = e.target
      if (hoveredEl === inspectOverlay) return
      const rect = hoveredEl.getBoundingClientRect()
      Object.assign(inspectOverlay.style, {
        display: 'block',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
      })
    }

    function onClick(e) {
      e.preventDefault()
      e.stopPropagation()

      if (hoveredEl && hoveredEl !== inspectOverlay) {
        const markdown = htmlToMarkdown(hoveredEl)
        // 显示"保存中"提示
        showPageToast('⏳ 正在保存元素...', 'info')
        // 通过 runtime message 发送结果回 background service worker
        chrome.runtime.sendMessage({
          action: 'inspectResult',
          content: markdown,
          title: document.title,
          url: location.href,
        }, (resp) => {
          if (resp?.ok) {
            showPageToast('✅ 已保存到知识库', 'success')
          } else {
            showPageToast('❌ 保存失败，请检查桌面端是否运行', 'error')
          }
        })
      }

      stopInspect()
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        stopInspect()
        const toast = document.getElementById('kbt-toast')
        if (toast) toast.remove()
      }
    }

    function stopInspect() {
      inspecting = false
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      if (inspectOverlay) {
        inspectOverlay.remove()
        inspectOverlay = null
      }
    }

    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)

    if (sendResponse) sendResponse({ started: true })
  }

  // 简化 HTML → Markdown 转换器
  function htmlToMarkdown(el) {
    if (!el) return ''
    return convertNode(el).trim()
  }

  function convertNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\s+/g, ' ')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const tag = node.tagName.toLowerCase()
    const children = Array.from(node.childNodes)
      .map(convertNode)
      .join('')

    switch (tag) {
      case 'h1':
        return `\n# ${children.trim()}\n\n`
      case 'h2':
        return `\n## ${children.trim()}\n\n`
      case 'h3':
        return `\n### ${children.trim()}\n\n`
      case 'h4':
        return `\n#### ${children.trim()}\n\n`
      case 'h5':
        return `\n##### ${children.trim()}\n\n`
      case 'h6':
        return `\n###### ${children.trim()}\n\n`
      case 'p':
        return `\n${children.trim()}\n\n`
      case 'br':
        return '\n'
      case 'hr':
        return '\n---\n\n'
      case 'strong':
      case 'b':
        return `**${children.trim()}**`
      case 'em':
      case 'i':
        return `*${children.trim()}*`
      case 'code':
        return `\`${children.trim()}\``
      case 'pre': {
        const codeEl = node.querySelector('code')
        const codeText = codeEl ? codeEl.textContent : node.textContent
        return `\n\`\`\`\n${codeText.trim()}\n\`\`\`\n\n`
      }
      case 'blockquote':
        return (
          '\n' +
          children
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n') +
          '\n\n'
        )
      case 'a': {
        const href = node.getAttribute('href')
        if (href && href !== '#') {
          const absHref = href.startsWith('http') ? href : new URL(href, location.href).href
          return `[${children.trim()}](${absHref})`
        }
        return children
      }
      case 'img': {
        const src = node.getAttribute('src')
        const alt = node.getAttribute('alt') || ''
        if (src) {
          const absSrc = src.startsWith('http') ? src : new URL(src, location.href).href
          return `![${alt}](${absSrc})`
        }
        return ''
      }
      case 'ul':
        return (
          '\n' +
          Array.from(node.children)
            .map((li) => `- ${convertNode(li).trim()}`)
            .join('\n') +
          '\n\n'
        )
      case 'ol':
        return (
          '\n' +
          Array.from(node.children)
            .map((li, i) => `${i + 1}. ${convertNode(li).trim()}`)
            .join('\n') +
          '\n\n'
        )
      case 'li':
        return children
      case 'table':
        return convertTable(node)
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'span':
      case 'figure':
      case 'figcaption':
        return children
      default:
        return children
    }
  }

  function convertTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (rows.length === 0) return ''

    const result = []
    rows.forEach((row, i) => {
      const cells = Array.from(row.querySelectorAll('th, td'))
      const line = '| ' + cells.map((c) => convertNode(c).trim().replace(/\|/g, '\\|')).join(' | ') + ' |'
      result.push(line)
      // 在第一行后添加分隔行
      if (i === 0) {
        result.push('| ' + cells.map(() => '---').join(' | ') + ' |')
      }
    })

    return '\n' + result.join('\n') + '\n\n'
  }
})()
} // end else (re-injection guard)
