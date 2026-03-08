// 端到端集成测试 — 网页采集到 Obsidian 写入（API + 文件两条路径）
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObsidianWriter } from '../../electron/obsidian-writer.js'
import { AutoTagger } from '../../electron/auto-tagger.js'
import { HttpServer } from '../../electron/http-server.js'

describe('E2E: 网页采集 → Obsidian 写入', () => {
  let writer
  let tagger
  let server

  beforeEach(() => {
    writer = new ObsidianWriter({
      vaultPath: '/tmp/test-vault',
      apiUrl: 'https://localhost:27124',
      apiToken: 'test',
      useApi: false, // 测试文件写入路径
      directories: {
        webClips: 'Inbox/WebClips',
        screenshots: 'Inbox/Screenshots',
        textNotes: 'Inbox/TextNotes',
        assets: 'assets',
      },
    })

    tagger = new AutoTagger([
      { keywords: ['JavaScript', 'TypeScript'], tags: ['JavaScript'], category: '编程/JavaScript' },
      { keywords: ['React', 'Vue'], tags: ['前端框架'], category: '编程/前端' },
    ])

    server = new HttpServer(0, writer, tagger)
  })

  it('AutoTagger 分析内容后生成正确的 frontmatter', () => {
    const content = '学习 JavaScript 和 React 框架的最佳实践'
    const analysis = tagger.analyze('', content)
    expect(analysis.tags).toContain('JavaScript')
    expect(analysis.tags).toContain('前端框架')
    expect(analysis.category).toBe('编程/JavaScript')

    const frontmatter = tagger.generateFrontmatter({
      title: '前端最佳实践',
      type: 'webClip',
      source: 'https://example.com',
      content,
    })
    expect(frontmatter).toContain('title: "前端最佳实践"')
    expect(frontmatter).toContain('type: webClip')
    expect(frontmatter).toContain('JavaScript')
    expect(frontmatter).toContain('前端框架')
  })

  it('HttpServer token 鉴权拒绝无效请求', async () => {
    await server.start()
    const port = server.server.address().port

    try {
      // 无 token
      const res1 = await fetch(`http://127.0.0.1:${port}/api/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test', content: 'test' }),
      })
      expect(res1.status).toBe(401)

      // 错误 token
      const res2 = await fetch(`http://127.0.0.1:${port}/api/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({ title: 'test', content: 'test' }),
      })
      expect(res2.status).toBe(401)
    } finally {
      await server.stop()
    }
  })

  it('完整链路: HTTP → AutoTag → Writer (mock)', async () => {
    // Mock writer.write
    writer.write = vi.fn().mockResolvedValue({ success: true, path: 'Inbox/WebClips/test.md' })

    let clipData = null
    server.onClip((data) => {
      clipData = data
    })

    await server.start()
    const port = server.server.address().port
    const token = server.getToken()

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'Vue 3 入门指南',
          content: '学习 Vue 和 React 前端框架',
          url: 'https://example.com/vue-guide',
          type: 'webClip',
          tags: ['教程'],
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)

      // 验证 writer 被调用
      expect(writer.write).toHaveBeenCalledTimes(1)
      const noteArg = writer.write.mock.calls[0][0]
      expect(noteArg.title).toBe('Vue 3 入门指南')
      expect(noteArg.frontmatter).toContain('Vue 3 入门指南')

      // 验证 onClip 回调
      expect(clipData).not.toBeNull()
      expect(clipData.title).toBe('Vue 3 入门指南')
    } finally {
      await server.stop()
    }
  })
})
