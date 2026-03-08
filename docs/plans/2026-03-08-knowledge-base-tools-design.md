# Knowledge Base Tools — 设计文档

> **日期**: 2026-03-08
> **状态**: 已确认
> **技术栈**: Electron + Vue3 JS + Chrome Extension (Manifest V3)

---

## 1. 项目概述

一款个人知识收集工具，帮助用户快速将浏览到的网页、文本文件、Markdown 文件以及屏幕截图+闪念笔记存入 Obsidian 知识库。

### 核心功能

1. **知识收集器** — 通过 Chrome 浏览器插件快速采集网页内容（整页/选中/元素检查提取），通过 Electron 主窗口粘贴文本/Markdown 内容，统一存入 Obsidian
2. **截图 + 闪念笔记** — 全局快捷键截屏（全屏/区域选择），弹出小窗输入灵感/待办/笔记，连同截图一起存入 Obsidian

---

## 2. 需求决策摘要

| 维度 | 决策 |
|---|---|
| Obsidian 写入 | REST API 优先 + 直接写文件 fallback |
| 浏览器插件 | Chrome Extension (Manifest V3) |
| 网页采集粒度 | 整页提取 + 选中文本 + 元素检查（深度 DOM 提取，绕过复制保护） |
| 截图触发 | 全局快捷键为主 + 系统托盘为辅 |
| 截图方式 | 全屏截图 + 区域框选 |
| 笔记目录 | 可配置，默认按类型分文件夹 |
| 应用形态 | 主窗口 + 托盘常驻（关闭窗口缩到托盘） |
| 插件通信 | 本地 HTTP 服务 (localhost:18321) |
| Frontmatter | 自动生成，含自动分类标签 |
| UI 风格 | 赛博朋克暗色主题 (Dark Cyberpunk Minimal) |

---

## 3. 架构设计

### 3.1 选定方案：单体 Electron 应用

```
┌─────────────────────────────────────────────┐
│           Electron 主应用 (Vue3)              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ 本地HTTP  │  │ 截图模块  │  │  主窗口    │  │
│  │  服务器   │  │(desktopC) │  │ (Vue3 UI) │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
│  ┌────┴──────────────┴──────────────┴─────┐  │
│  │        Obsidian 写入引擎               │  │
│  │  (REST API → fallback → 直接写文件)     │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         ▲
         │ HTTP POST
┌────────┴────────┐
│ Chrome Extension │
│  (内容提取+发送) │
└─────────────────┘
```

### 3.2 项目结构

```
knowledge-base-tools/
├── electron/                    # Electron 主进程
│   ├── main.js                  # 应用入口、窗口管理、托盘、快捷键
│   ├── http-server.js           # 本地 HTTP 服务（接收浏览器插件数据）
│   ├── obsidian-writer.js       # Obsidian 写入引擎（API + 文件 fallback）
│   ├── screenshot.js            # 截图模块（全屏 + 区域选择）
│   ├── auto-tagger.js           # 自动分类标签生成
│   └── config-store.js          # 配置持久化（electron-store）
├── src/                         # Vue3 渲染进程
│   ├── App.vue
│   ├── views/
│   │   ├── MainView.vue         # 主窗口：历史记录 + 手动输入
│   │   ├── SettingsView.vue     # 设置页：Obsidian 路径、目录映射、快捷键
│   │   └── QuickNote.vue        # 截图后弹出的快速笔记窗口
│   ├── components/
│   │   ├── NoteCard.vue         # 历史记录卡片
│   │   ├── TagEditor.vue        # 标签编辑器
│   │   └── TextPasteInput.vue   # 文本粘贴入库组件
│   └── stores/                  # Pinia 状态管理
│       ├── notes.js
│       └── settings.js
├── chrome-extension/            # Chrome 浏览器插件
│   ├── manifest.json            # Manifest V3
│   ├── popup/                   # 插件弹出窗口
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/                 # 内容脚本（DOM 提取）
│   │   └── extractor.js
│   └── background/              # Service Worker
│       └── service-worker.js
├── package.json
├── vite.config.js               # Vite 构建（Vue3 渲染进程）
└── electron-builder.yml         # 打包配置
```

### 3.3 核心数据流

```
【网页采集流】
Chrome Extension → HTTP POST → Electron HTTP 服务器 → 自动标签 → Obsidian 写入引擎 → .md 文件

【文本粘贴流】
主窗口粘贴区 → 自动标签 → Obsidian 写入引擎 → .md 文件

【截图+闪念流】
全局快捷键 → 截图(全屏/区域) → 弹出 QuickNote 窗口 → 用户输入文字 → Obsidian 写入引擎 → .md + .png
```

### 3.4 技术栈

| 组件 | 技术选型 |
|---|---|
| 桌面框架 | Electron 33+ |
| 前端框架 | Vue 3 + Vite |
| 状态管理 | Pinia |
| UI 风格 | 自定义 CSS（赛博朋克暗色主题） |
| HTTP 服务 | Electron 内嵌 Express/Fastify |
| 配置持久化 | electron-store |
| HTML→Markdown | turndown |
| 截图 | Electron desktopCapturer + 透明窗口 |
| 自动标签 | 基于关键词规则匹配（本地方案） |
| 浏览器插件 | Chrome Extension Manifest V3 |
| 图标 | Lucide Icons |

---

## 4. Chrome Extension 设计

### 4.1 权限

```json
{
  "manifest_version": 3,
  "name": "KBT Web Clipper",
  "permissions": ["activeTab", "contextMenus", "storage"],
  "host_permissions": ["http://localhost:18321/*"],
  "action": { "default_popup": "popup/popup.html" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/extractor.js"],
    "run_at": "document_idle"
  }],
  "background": { "service_worker": "background/service-worker.js" }
}
```

### 4.2 三种采集入口

| 入口 | 触发方式 | 行为 |
|---|---|---|
| **保存整页** | 点击插件图标 → popup 中点击"保存整页" | 向 content script 发消息提取全文，发送到 Electron |
| **保存选中** | 选中文字 → 右键菜单"保存到知识库" | 获取 `window.getSelection()`，发送到 Electron |
| **元素检查提取** | popup 中点击"元素检查" → 页面进入选择模式 | 鼠标悬停高亮 DOM 元素，点击后提取该元素内容 |

### 4.3 内容提取策略

```
1. 整页提取：
   - Readability.js 算法提取正文（去导航/广告）
   - 提取 title、meta description、og:image
   - HTML → Markdown（Turndown）

2. 选中文本提取：
   - 获取 Selection 对象，保留富文本格式
   - HTML 片段 → Markdown

3. 元素检查提取（绕过复制保护）：
   - 注入 overlay 层，鼠标悬停高亮元素
   - 点击获取 element.innerHTML / innerText
   - 递归提取子元素，重建内容结构
   - 处理 user-select:none / oncopy 覆盖
```

### 4.4 发送数据格式

```json
{
  "type": "web-clip",
  "source": "https://example.com/article",
  "title": "文章标题",
  "content": "提取的 Markdown 内容...",
  "html": "<原始 HTML>",
  "excerpt": "摘要（前200字）",
  "siteName": "网站名称",
  "capturedAt": "2026-03-08T14:30:00.000Z",
  "mode": "full-page | selection | element"
}
```

### 4.5 Popup 界面

```
┌──────────────────────────┐
│  ◆ KBT Web Clipper       │
├──────────────────────────┤
│  [保存整页]               │
│  [保存选中内容]           │
│  [元素检查模式]           │
├──────────────────────────┤
│  标题: [自动填充，可编辑]  │
│  标签: [自动建议，可编辑]  │
│  [发送到知识库]           │
├──────────────────────────┤
│  ● 已连接 Electron       │
└──────────────────────────┘
```

---

## 5. Electron 主应用设计

### 5.1 本地 HTTP 服务器

```
端口: 18321（可配置）
安全:
  - 仅监听 127.0.0.1
  - 启动时生成随机 token，Chrome Extension 首次连接时配对
  - 请求头 Authorization: Bearer <token>

端点:
  POST /api/clip          ← 接收网页采集内容
  POST /api/text          ← 接收文本粘贴内容
  GET  /api/ping          ← 健康检查
  GET  /api/tags          ← 获取已有标签列表
  POST /api/screenshot    ← 触发截图（备用）
```

### 5.2 Obsidian 写入引擎

```
双通道 fallback 策略:

1. 优先: Obsidian Local REST API (https://localhost:27124)
   - 自动检测是否可达
   - 通过 API 创建笔记、上传附件

2. Fallback: 直接写文件系统
   - 读取配置中 Vault 路径
   - 直接写 .md 文件
   - 图片写到附件目录

文件命名:
  网页:    {YYYY-MM-DD}_{sanitized-title}.md
  文本:    {YYYY-MM-DD}_{前20字}.md
  截图笔记: {YYYY-MM-DD}_{HHmmss}_闪念.md
  截图图片: assets/{YYYY-MM-DD}_{HHmmss}.png
```

### 5.3 自动标签 & Frontmatter

```yaml
---
title: "深入理解 JavaScript 事件循环"
source: "https://example.com/js-event-loop"
type: web-clip
category: 编程/JavaScript
tags:
  - JavaScript
  - 事件循环
  - 异步编程
created: 2026-03-08T14:30:00
---
```

```
自动标签策略（本地规则引擎）:
1. 用户可配置关键词→标签/分类映射规则
   - ["JavaScript", "TypeScript", "Node.js"] → 标签 "JavaScript", 分类 "编程/JavaScript"
   - ["React", "Vue", "Angular"] → 标签 "前端框架", 分类 "编程/前端"
2. 扫描 title + content 前500字进行匹配
3. 无匹配时分类为 "未分类"
4. 用户可在保存前手动编辑标签
```

### 5.4 截图 + 闪念笔记

```
触发:
  Ctrl+Shift+K — 全屏截图
  Ctrl+Shift+A — 区域选择截图
  托盘菜单 — 备选入口

全屏截图:
  - desktopCapturer.getSources({ types: ['screen'] })
  - 保存 PNG 到临时目录

区域截图:
  - 先全屏截图
  - 创建透明全屏窗口，截图作为背景
  - 用户拖拽框选
  - 裁剪选区保存

截图后弹出 QuickNote 窗口:
  - 截图预览
  - 多行文本输入
  - 类型选择: 灵感 / 待办 / 笔记
  - 标签编辑
  - 保存到知识库

生成 Markdown:
  ---
  title: "闪念-2026-03-08 14:30"
  type: screenshot-note
  category: 灵感
  tags: []
  created: 2026-03-08T14:30:00
  ---

  用户输入的文字...

  ![[assets/2026-03-08_143000.png]]
```

### 5.5 主窗口功能

```
- 左侧导航: 收藏、截图、设置
- 历史记录: 最近保存的条目（从 Vault 读取）
- 快速文本入库: 粘贴 → 自动标签 → 保存
- 设置页: Vault 路径、API 配置、目录映射、快捷键、标签规则
```

---

## 6. UI 视觉设计 — 暗夜霓虹 · 赛博质感

### 6.1 风格: Dark Cyberpunk Minimal

深色玻璃拟态 + 赛博朋克霓虹，深渊黑底 + 霓虹紫青双色交织。

### 6.2 调色板

| 层级 | 色名 | 色值 | 用途 |
|---|---|---|---|
| 背景 | 深渊黑 | #08080F | 主背景 |
| 背景 | 暗紫黑 | #0E0E1A | 侧边栏/卡片背景 |
| 背景 | 午夜蓝 | #141422 | 弹窗背景 |
| 表面 | 暗钴蓝 | #1C1C30 | 输入框/次级面板 |
| 表面 | 石英紫 | #262640 | hover 状态 |
| 表面 | 钛蓝灰 | #30304A | 边框/分割线 |
| 主强调 | 霓虹紫 | #BF5AF2 | 主按钮/品牌色 |
| 主强调 | 暗紫 | #9D48C8 | hover |
| 主强调 | 浅紫 | #D98EF9 | 高亮/badge |
| 次强调 | 荧光青 | #00F0FF | 链接/活跃指示 |
| 次强调 | 暗青 | #00C4D4 | hover |
| 次强调 | 冰蓝 | #7DF9FF | 次级高亮 |
| 特殊 | 赛博粉 | #FF2E97 | 警告/收藏标记 |
| 特殊 | 电光黄 | #FFE558 | 点缀/计数 |
| 文字 | 冷白色 | #E4E4F0 | 主文字 |
| 文字 | 灰紫色 | #8888A8 | 次级文字 |
| 文字 | 暗灰紫 | #4C4C66 | placeholder |
| 状态 | 矩阵绿 | #00F0A0 | 成功 |
| 状态 | 烈焰红 | #FF4466 | 错误 |

### 6.3 核心视觉效果

```css
/* 卡片 — 暗面玻璃 + 紫色微光边框 */
.card {
  background: rgba(14, 14, 26, 0.75);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(191, 90, 242, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.card:hover {
  border-color: rgba(191, 90, 242, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(191, 90, 242, 0.08);
  transform: translateY(-1px);
}

/* 主按钮 — 霓虹紫 */
.btn-primary {
  background: linear-gradient(135deg, #BF5AF2, #9D48C8);
  color: #FFFFFF;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #D06EFF, #BF5AF2);
  box-shadow: 0 0 24px rgba(191, 90, 242, 0.4);
}

/* 输入框 — 聚焦青色光晕 */
.input:focus {
  border-color: rgba(0, 240, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 240, 255, 0.1);
}

/* 侧边栏选中 — 紫色指示条 */
.nav-item.active {
  background: rgba(191, 90, 242, 0.1);
  border-left: 2px solid #BF5AF2;
  color: #D98EF9;
}

/* 标签 */
.tag { background: rgba(191, 90, 242, 0.15); border: 1px solid rgba(191, 90, 242, 0.3); color: #D98EF9; }
.tag.secondary { background: rgba(0, 240, 255, 0.1); border-color: rgba(0, 240, 255, 0.25); color: #7DF9FF; }

/* 渐变分割线 */
.divider { background: linear-gradient(90deg, rgba(191, 90, 242, 0.3), rgba(0, 240, 255, 0.2), transparent); }
```

### 6.4 字体

```
标题/正文: Inter (400/500/600)
等宽: JetBrains Mono
中文回退: PingFang SC, Microsoft YaHei
```

### 6.5 图标

使用 Lucide Icons — 线条感强、风格统一、开源免费。

### 6.6 设计原则

| 原则 | 实现 |
|---|---|
| 低调 | 深渊黑基底，霓虹色仅用在关键交互点 |
| 赛博感 | 紫+青双色系统，hover 微发光效果 |
| 内涵 | 克制用色，紫做主交互，青做辅助，粉做警告 |
| 现代感 | 圆角 8-12px、毛玻璃、渐变线、微动效 0.2s |
| 实用 | 高对比度冷白文字、清晰交互反馈、键盘可达 |

---

## 7. 放弃的方案

### 方案 B：Electron 壳 + 独立 Node 后台服务
放弃理由：架构复杂，两套通信协议，对个人工具过度设计。

### 方案 C：浏览器插件独立 + 轻量 Electron
放弃理由：两套 Obsidian 写入逻辑，配置分散，Extension 无法直接写本地文件。
