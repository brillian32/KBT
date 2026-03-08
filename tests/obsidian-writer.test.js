import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ObsidianWriter } from '../electron/obsidian-writer.js'

let tmpDir
let writer

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `kbt-obsidian-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  writer = new ObsidianWriter({
    vaultPath: tmpDir,
    directories: {
      webClips: 'Inbox/WebClips',
      screenshots: 'Inbox/Screenshots',
      textNotes: 'Inbox/TextNotes',
      assets: 'assets',
    },
    useApi: false,
  })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('ObsidianWriter', () => {
  describe('writeViaFile', () => {
    it('应能将笔记写入文件', async () => {
      const note = {
        title: '测试笔记',
        content: '# 测试内容\n\n这是一个测试笔记。',
        type: 'text',
        frontmatter: '---\ntags: [测试]\ndate: 2026-03-08\n---\n',
      }

      const filePath = await writer.writeViaFile(note)
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('tags: [测试]')
      expect(content).toContain('# 测试内容')
    })

    it('应将 webClip 类型写入 WebClips 目录', async () => {
      const note = {
        title: 'Web文章',
        content: '# 文章标题\n\n正文内容',
        type: 'webClip',
      }

      const filePath = await writer.writeViaFile(note)
      expect(filePath).toContain('Inbox')
      expect(filePath).toContain('WebClips')
    })

    it('应将 screenshot 类型写入 Screenshots 目录', async () => {
      const note = {
        title: '截图笔记',
        content: '这是截图的补充说明',
        type: 'screenshot',
      }

      const filePath = await writer.writeViaFile(note)
      expect(filePath).toContain('Screenshots')
    })

    it('应处理文件名中的非法字符', async () => {
      const note = {
        title: '测试/文件:名称*特殊<字符>',
        content: '内容',
        type: 'text',
      }

      const filePath = await writer.writeViaFile(note)
      expect(fs.existsSync(filePath)).toBe(true)
      // 文件名不应包含非法字符
      const filename = path.basename(filePath)
      expect(filename).not.toMatch(/[<>:"/\\|?*]/)
    })

    it('同名文件应自动添加后缀避免覆盖', async () => {
      const note = {
        title: '重复笔记',
        content: '内容1',
        type: 'text',
      }

      const path1 = await writer.writeViaFile(note)
      const path2 = await writer.writeViaFile({ ...note, content: '内容2' })

      expect(path1).not.toBe(path2)
      expect(fs.existsSync(path1)).toBe(true)
      expect(fs.existsSync(path2)).toBe(true)
    })
  })

  describe('saveImage', () => {
    it('应保存图片到 assets 目录', async () => {
      const imageBuffer = Buffer.from('fake-png-data')
      const filename = 'screenshot-2026.png'

      const imagePath = await writer.saveImage(imageBuffer, filename)
      expect(fs.existsSync(imagePath)).toBe(true)
      expect(imagePath).toContain('assets')

      const savedData = fs.readFileSync(imagePath)
      expect(savedData.equals(imageBuffer)).toBe(true)
    })
  })

  describe('write (统一入口)', () => {
    it('useApi=false 时应直接走文件写入', async () => {
      const note = {
        title: '直接写入',
        content: '测试内容',
        type: 'text',
      }

      const result = await writer.write(note)
      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()
      expect(fs.existsSync(result.path)).toBe(true)
    })
  })

  describe('checkApiAvailable', () => {
    it('API 不可达时应返回 false', async () => {
      const apiWriter = new ObsidianWriter({
        vaultPath: tmpDir,
        directories: { webClips: 'Inbox/WebClips', screenshots: 'Inbox/Screenshots', textNotes: 'Inbox/TextNotes', assets: 'assets' },
        useApi: true,
        apiUrl: 'http://localhost:19999',
        apiToken: 'test',
      })

      const available = await apiWriter.checkApiAvailable()
      expect(available).toBe(false)
    })
  })
})
