// 端到端集成测试 — 文本粘贴 → 自动标签 → 保存
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObsidianWriter } from '../../electron/obsidian-writer.js'
import { AutoTagger } from '../../electron/auto-tagger.js'
import { HttpServer } from '../../electron/http-server.js'

describe('E2E: 文本粘贴 → 自动标签 → 保存', () => {
  let writer
  let tagger
  let server

  beforeEach(() => {
    writer = new ObsidianWriter({
      vaultPath: '/tmp/test-vault',
      useApi: false,
      directories: {
        webClips: 'Inbox/WebClips',
        screenshots: 'Inbox/Screenshots',
        textNotes: 'Inbox/TextNotes',
        assets: 'assets',
      },
    })

    tagger = new AutoTagger([
      { keywords: ['Python', 'Django'], tags: ['Python'], category: '编程/Python' },
    ])

    server = new HttpServer(0, writer, tagger)
  })

  it('文本经自动标签处理后正确写入', async () => {
    writer.write = vi.fn().mockResolvedValue({ success: true, path: 'Inbox/TextNotes/test.md' })

    await server.start()
    const port = server.server.address().port
    const token = server.getToken()

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'Python 学习笔记',
          content: '今天学习了 Python 和 Django 框架',
          tags: ['学习'],
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)

      // 验证 writer 被正确调用
      const noteArg = writer.write.mock.calls[0][0]
      expect(noteArg.type).toBe('text')
      expect(noteArg.frontmatter).toContain('Python 学习笔记')
      expect(noteArg.frontmatter).toContain('type: text')
    } finally {
      await server.stop()
    }
  })

  it('无内容的文本请求也能处理', async () => {
    writer.write = vi.fn().mockResolvedValue({ success: true, path: 'test.md' })

    await server.start()
    const port = server.server.address().port
    const token = server.getToken()

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
      const noteArg = writer.write.mock.calls[0][0]
      expect(noteArg.title).toBe('未命名')
      expect(noteArg.content).toBe('')
    } finally {
      await server.stop()
    }
  })
})
