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

  // 页面内轻提示（仅 info 类型常驻，其余 3s 后自动消失）
  function showPageToast(text, type = 'info') {
    const existing = document.getElementById('kbt-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'kbt-toast'
    const C = {
      info:    ['rgba(0,240,255,0.13)',  '#00F0FF'],
      success: ['rgba(0,255,136,0.13)',  '#00FF88'],
      error:   ['rgba(255,51,102,0.13)', '#FF3366'],
    }
    const [bg, color] = C[type] || C.info
    Object.assign(toast.style, {
      position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '2147483647', padding: '9px 18px', borderRadius: '8px',
      border: `1px solid ${color}`, background: bg, color, fontSize: '13px',
      fontFamily: 'system-ui, sans-serif', boxShadow: `0 0 14px ${color}44`,
      backdropFilter: 'blur(8px)', pointerEvents: 'none', whiteSpace: 'nowrap',
    })
    toast.textContent = text
    document.body.appendChild(toast)
    if (type !== 'info') setTimeout(() => toast.remove(), 3000)
    return toast
  }

  // 元素检查模式 — 多选 + 编辑面板后保存
  function startInspect(sendResponse) {
    if (inspecting) {
      // 已在检查中则退出
      document.getElementById('kbt-action-bar')?.remove()
      document.getElementById('kbt-edit-host')?.remove()
      document.getElementById('kbt-toast')?.remove()
      document.getElementById('kbt-sel-style')?.remove()
      document.querySelectorAll('[data-kbt-s]').forEach(el => delete el.dataset.kbtS)
      if (inspectOverlay) { inspectOverlay.remove(); inspectOverlay = null }
      inspecting = false
      if (sendResponse) sendResponse({ content: null })
      return
    }

    inspecting = true
    const selectedEls = []
    let hoveredEl = null

    // 选中高亮样式
    const styleEl = document.createElement('style')
    styleEl.id = 'kbt-sel-style'
    styleEl.textContent = '[data-kbt-s]{outline:2px solid #BF5AF2!important;outline-offset:2px!important}'
    document.head.appendChild(styleEl)

    // 悬停 overlay
    inspectOverlay = document.createElement('div')
    inspectOverlay.id = 'kbt-inspect-overlay'
    Object.assign(inspectOverlay.style, {
      position: 'fixed', pointerEvents: 'none',
      border: '2px dashed #00F0FF', background: 'rgba(0,240,255,0.06)',
      borderRadius: '2px', zIndex: '2147483645', transition: 'all 70ms', display: 'none',
    })
    document.body.appendChild(inspectOverlay)

    // 底部操作栏
    const bar = document.createElement('div')
    bar.id = 'kbt-action-bar'
    Object.assign(bar.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '2147483647', display: 'flex', gap: '10px', alignItems: 'center',
      padding: '10px 20px', background: '#12121E',
      border: '1px solid rgba(0,240,255,0.3)', borderRadius: '40px',
      boxShadow: '0 0 28px rgba(0,240,255,0.18)', fontFamily: 'system-ui,sans-serif',
      fontSize: '13px', color: '#E0E0E0', userSelect: 'none', whiteSpace: 'nowrap',
    })
    bar.innerHTML =
      '<span style="color:#00F0FF;font-weight:700;letter-spacing:1px">KBT</span>' +
      '<span style="color:#333">|</span>' +
      '<span id="kbt-cnt" style="color:#BF5AF2;font-size:12px;min-width:72px">已选 0 个元素</span>' +
      '<button id="kbt-ok" style="padding:5px 16px;border:1px solid #BF5AF2;border-radius:20px;background:rgba(191,90,242,0.15);color:#BF5AF2;cursor:pointer;font-size:12px;transition:all 150ms;opacity:.45" disabled>预览并保存</button>' +
      '<button id="kbt-esc" style="padding:5px 12px;border:1px solid #2A2A4E;border-radius:20px;background:transparent;color:#666;cursor:pointer;font-size:12px">退出</button>' +
      '<span style="color:#3A3A5A;font-size:11px">单击选择 · Ctrl+单击多选 · ESC退出</span>'
    document.body.appendChild(bar)

    const cntEl  = bar.querySelector('#kbt-cnt')
    const btnOk  = bar.querySelector('#kbt-ok')
    const btnEsc = bar.querySelector('#kbt-esc')

    function updateBar() {
      const n = selectedEls.length
      cntEl.textContent = `已选 ${n} 个元素`
      btnOk.disabled = n === 0
      btnOk.style.opacity = n > 0 ? '1' : '.45'
    }

    function addSel(el) {
      if (!selectedEls.includes(el)) { selectedEls.push(el); el.dataset.kbtS = '1' }
    }
    function removeSel(el) {
      const i = selectedEls.indexOf(el)
      if (i > -1) { selectedEls.splice(i, 1); delete el.dataset.kbtS }
    }
    function clearSels() { selectedEls.forEach(el => delete el.dataset.kbtS); selectedEls.length = 0 }

    function onMouseMove(e) {
      hoveredEl = e.target
      if (!hoveredEl || hoveredEl === inspectOverlay || bar.contains(hoveredEl)) {
        inspectOverlay.style.display = 'none'; return
      }
      const r = hoveredEl.getBoundingClientRect()
      Object.assign(inspectOverlay.style, {
        display: 'block', top: r.top + 'px', left: r.left + 'px',
        width: r.width + 'px', height: r.height + 'px',
      })
    }

    function onClick(e) {
      if (bar.contains(e.target)) return
      e.preventDefault(); e.stopPropagation()
      if (!hoveredEl || hoveredEl === inspectOverlay) return
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+单击：切换多选
        selectedEls.includes(hoveredEl) ? removeSel(hoveredEl) : addSel(hoveredEl)
      } else {
        // 普通单击：单选（清除已选，选择当前）
        clearSels(); addSel(hoveredEl)
      }
      updateBar()
    }

    function onKeyDown(e) { if (e.key === 'Escape') stop() }

    function stop() {
      inspecting = false
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      if (inspectOverlay) { inspectOverlay.remove(); inspectOverlay = null }
      bar.remove()
      clearSels()
      document.getElementById('kbt-sel-style')?.remove()
      document.getElementById('kbt-edit-host')?.remove()
      document.getElementById('kbt-toast')?.remove()
    }

    btnOk.addEventListener('click', e => {
      e.stopPropagation()
      if (!selectedEls.length) return
      // 合并所有选中元素内容（分隔线分隔）
      const merged = selectedEls
        .map((el, i) => (i === 0 ? '' : '\n\n---\n\n') + htmlToMarkdown(el))
        .join('')
      // 暂停检查监听，显示编辑面板
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      inspectOverlay.style.display = 'none'
      bar.style.display = 'none'
      showEditPanel(
        { title: document.title, content: merged, url: location.href, count: selectedEls.length },
        stop
      )
    })

    btnEsc.addEventListener('click', e => { e.stopPropagation(); stop() })

    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)

    showPageToast('🔍 KBT 检查模式 — 单击选择，Ctrl+单击多选，ESC 退出', 'info')
    if (sendResponse) sendResponse({ started: true })
  }

  // 编辑面板（Shadow DOM 隔离样式）
  function showEditPanel({ title, content, url, count }, onDone) {
    const host = document.createElement('div')
    host.id = 'kbt-edit-host'
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })

    const css = `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .bd { position: fixed; inset: 0; background: rgba(0,0,0,.82); z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            font-family: system-ui,-apple-system,sans-serif; }
      .panel { background: #11111D; border: 1px solid #252540; border-radius: 16px;
               width: 540px; max-height: 86vh; overflow-y: auto; padding: 24px;
               display: flex; flex-direction: column; gap: 16px; color: #E0E0E0;
               box-shadow: 0 0 60px rgba(0,240,255,.1), 0 32px 64px rgba(0,0,0,.6); }
      .hd { display: flex; align-items: center; gap: 10px; }
      .ht { font-size: 15px; font-weight: 700; color: #00F0FF; letter-spacing: 1px; flex: 1; }
      .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px;
               background: rgba(191,90,242,.15); border: 1px solid rgba(191,90,242,.4); color: #BF5AF2; }
      .fld { display: flex; flex-direction: column; gap: 6px; }
      label { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .5px; }
      label small { text-transform: none; font-weight: 400; color: #3A3A5A; margin-left: 4px; }
      input, textarea { background: #0A0A16; border: 1px solid #1E1E36; border-radius: 8px;
                        color: #E0E0E0; font-family: inherit; font-size: 13px; outline: none;
                        padding: 9px 12px; transition: border-color 150ms; width: 100%; }
      input:focus, textarea:focus { border-color: #00F0FF; box-shadow: 0 0 0 2px rgba(0,240,255,.07); }
      textarea { min-height: 160px; resize: vertical; line-height: 1.7; font-size: 12px;
                 font-family: 'Cascadia Code','Fira Code',monospace; }
      .tw { display: flex; flex-wrap: wrap; gap: 5px; background: #0A0A16; border: 1px solid #1E1E36;
            border-radius: 8px; padding: 6px 8px; min-height: 38px; align-items: center;
            cursor: text; transition: border-color 150ms; }
      .tw:focus-within { border-color: #00F0FF; box-shadow: 0 0 0 2px rgba(0,240,255,.07); }
      .tc { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px;
            background: rgba(0,240,255,.1); border: 1px solid rgba(0,240,255,.3);
            border-radius: 4px; color: #00F0FF; font-size: 11px; }
      .tr { background: none; border: none; color: #00F0FF; cursor: pointer;
            font-size: 14px; padding: 0 0 0 2px; line-height: 1; opacity: .6; }
      .tr:hover { opacity: 1; }
      .ti { background: none; border: none; color: #E0E0E0; font-size: 12px;
            outline: none; flex: 1; min-width: 80px; padding: 2px 4px; width: auto; }
      .st { font-size: 12px; padding: 9px 12px; border-radius: 8px; text-align: center; display: none; }
      .st-ok  { background: rgba(0,255,136,.08); border: 1px solid rgba(0,255,136,.25); color: #00FF88; }
      .st-err { background: rgba(255,51,102,.08); border: 1px solid rgba(255,51,102,.25); color: #FF3366; }
      .acts { display: flex; justify-content: flex-end; gap: 8px; padding-top: 14px; border-top: 1px solid #1A1A2E; }
      .btn { padding: 8px 20px; border-radius: 8px; font-size: 13px; cursor: pointer;
             font-family: inherit; transition: all 150ms; font-weight: 500; }
      .bc { background: transparent; border: 1px solid #252540; color: #555; }
      .bc:hover { border-color: #3A3A5A; color: #999; }
      .bs { background: linear-gradient(135deg,#7B2FBE,#BF5AF2); border: none; color: #fff; font-weight: 600; }
      .bs:hover { box-shadow: 0 4px 18px rgba(191,90,242,.35); transform: translateY(-1px); }
      .bs:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
    `
    const html =
      '<div class="bd" id="bd"><div class="panel">' +
        '<div class="hd"><span class="ht">KBT · 编辑后保存</span><span class="badge">已选 ' + count + ' 个元素</span></div>' +
        '<div class="fld"><label>标题</label><input id="t" type="text" /></div>' +
        '<div class="fld"><label>标签<small>回车添加 · Backspace删除</small></label>' +
          '<div class="tw" id="tw"><input id="ti" class="ti" placeholder="输入标签后回车..." /></div></div>' +
        '<div class="fld"><label>内容<small>可直接编辑</small></label><textarea id="c"></textarea></div>' +
        '<div id="st" class="st"></div>' +
        '<div class="acts"><button class="btn bc" id="bc">取消</button><button class="btn bs" id="bs">存入知识库</button></div>' +
      '</div></div>'

    const styleNode = document.createElement('style')
    styleNode.textContent = css
    shadow.appendChild(styleNode)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    shadow.appendChild(wrapper)

    // 安全赋值（避免 XSS / 标签注入）
    shadow.getElementById('t').value = title
    shadow.getElementById('c').value = content

    // 标签管理
    const tags = []
    const tw = shadow.getElementById('tw')
    const ti = shadow.getElementById('ti')

    function renderTags() {
      tw.querySelectorAll('.tc').forEach(c => c.remove())
      tags.forEach(tag => {
        const chip = document.createElement('span')
        chip.className = 'tc'
        chip.textContent = tag
        const rm = document.createElement('button')
        rm.className = 'tr'; rm.textContent = '×'
        rm.addEventListener('click', () => { tags.splice(tags.indexOf(tag), 1); renderTags() })
        chip.appendChild(rm)
        tw.insertBefore(chip, ti)
      })
    }

    ti.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const v = ti.value.trim()
        if (v && !tags.includes(v)) { tags.push(v); renderTags() }
        ti.value = ''
      }
      if (e.key === 'Backspace' && !ti.value && tags.length) { tags.pop(); renderTags() }
    })
    tw.addEventListener('click', () => ti.focus())

    // 保存
    const stEl = shadow.getElementById('st')
    const bs   = shadow.getElementById('bs')
    shadow.getElementById('bc').addEventListener('click', () => { host.remove(); onDone() })

    bs.addEventListener('click', () => {
      const titleVal   = shadow.getElementById('t').value.trim() || document.title
      const contentVal = shadow.getElementById('c').value.trim()
      if (!contentVal) return
      bs.disabled = true; bs.textContent = '保存中...'
      chrome.runtime.sendMessage(
        { action: 'inspectResult', title: titleVal, content: contentVal, url, tags: [...tags] },
        resp => {
          if (resp?.ok) {
            stEl.className = 'st st-ok'; stEl.textContent = '✅ 已成功保存到知识库'; stEl.style.display = ''
            setTimeout(() => { host.remove(); onDone() }, 1500)
          } else {
            stEl.className = 'st st-err'; stEl.textContent = '❌ 保存失败，请检查桌面端是否运行'; stEl.style.display = ''
            bs.disabled = false; bs.textContent = '存入知识库'
          }
        }
      )
    })

    // 点击背景关闭
    shadow.getElementById('bd').addEventListener('click', e => {
      if (e.target.id === 'bd') { host.remove(); onDone() }
    })
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
