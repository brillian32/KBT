# 修复区域截图流程 & UI 对齐

> **日期**: 2026-03-08
> **状态**: 进行中
> **范围**: 区域截图断裂的 IPC 流程 + CSS 变量对齐设计文档 + SideNav 截图按钮

---

## 问题列表

### P0：区域截图流程断裂
- `SideNav` 导航到 `/capture` 路由，但该路由不存在
- `RegionSelect.vue` 调用 `confirmRegion()`/`cancelRegion()` 但 `preload.js` 未暴露
- `main.js` 的 `handleScreenshot('region')` 只向主窗口发消息，未创建区域选择窗口
- 整个区域截图流程无法工作

### P1：CSS 变量与设计文档不一致
- 多个颜色值偏离设计文档定义（如 neon-purple、bg 色、text 色、状态色等）
- 设计文档主强调色为霓虹紫 #BF5AF2，当前实现以青色为主（可接受但需对齐变量）

---

## 修复方案

### 1. SideNav 截图按钮 → 触发截图动作而非路由导航
- 添加 `handler` 属性区分导航项和动作项
- 截图按钮点击时直接调用 `window.electronAPI.takeScreenshot('full')`

### 2. preload.js 补充区域截图 IPC API
```js
confirmRegion: (bounds) => ipcRenderer.invoke('region:confirm', bounds),
cancelRegion: () => ipcRenderer.invoke('region:cancel'),
```

### 3. main.js 实现区域截图窗口流程
正确流程：
1. `handleScreenshot('region')` → 先全屏截图 → 创建透明全屏窗口加载 RegionSelect
2. RegionSelect 用 `screenshot:taken` 事件接收截图 base64 作为背景
3. 用户框选后 `region:confirm(bounds)` → 裁剪截图 → 关闭区域窗口 → 打开 QuickNote
4. 用户取消 `region:cancel` → 关闭区域窗口

### 4. RegionSelect.vue 修复背景图获取方式
- 改用 `electronAPI.onScreenshotTaken()` 接收背景截图（替代 URL 参数）

### 5. CSS 变量对齐设计文档色彩
```
深渊黑 #08080F → --bg-deep
暗紫黑 #0E0E1A → --bg-panel
午夜蓝 #141422 → --bg-card
暗钴蓝 #1C1C30 → --bg-elevated
霓虹紫 #BF5AF2 → --neon-purple
赛博粉 #FF2E97 → --neon-magenta
烈焰红 #FF4466 → --error
矩阵绿 #00F0A0 → --success
```

---

## 完成标准
- [ ] 区域截图全流程可用（快捷键触发 → 选区 → QuickNote）
- [ ] SideNav 截图按钮正确触发截图
- [ ] CSS 变量与设计文档一致
- [ ] 所有原有测试仍通过
- [ ] 新流程有对应测试
