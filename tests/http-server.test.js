import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { HttpServer } from '../electron/http-server.js'

// mock ObsidianWriter 和 AutoTagger
const mockWriter = {
  write: vi.fn().mockResolvedValue({ success: true, path: '/test/note.md', method: 'file' }),
  saveImage: vi.fn().mockResolvedValue('/test/image.png'),
}

const mockTagger = {
  generateFrontmatter: vi.fn().mockReturnValue('---\ntags: [测试]\n---\n'),
  analyze: vi.fn().mockReturnValue({ tags: ['测试'], category: 'Inbox' }),
}

let server
let baseUrl
const TEST_PORT = 18399

beforeAll(async () => {
  server = new HttpServer(TEST_PORT, mockWriter, mockTagger)
  await server.start()
  baseUrl = `http://127.0.0.1:${TEST_PORT}`
})

afterAll(async () => {
  await server.stop()
})

describe('HttpServer', () => {
  describe('GET /api/ping', () => {
    it('应返回 200', async () => {
      const res = await fetch(`${baseUrl}/api/ping`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('ok')
    })
  })

  describe('POST /api/clip 鉴权', () => {
    it('不带 token 应返回 401', async () => {
      const res = await fetch(`${baseUrl}/api/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '测试', content: '内容' }),
      })
      expect(res.status).toBe(401)
    })

    it('带错误 token 应返回 401', async () => {
      const res = await fetch(`${baseUrl}/api/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-token',
        },
        body: JSON.stringify({ title: '测试', content: '内容' }),
      })
      expect(res.status).toBe(401)
    })

    it('带正确 token 应返回 200', async () => {
      const token = server.getToken()
      const res = await fetch(`${baseUrl}/api/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: '测试文章',
          content: '# 测试内容\n\n正文',
          url: 'https://example.com',
          type: 'webClip',
        }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/text', () => {
    it('带正确 token 应保存文本', async () => {
      const token = server.getToken()
      const res = await fetch(`${baseUrl}/api/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: '文本笔记',
          content: '这是一段文本内容',
          tags: ['笔记'],
        }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('GET /api/tags', () => {
    it('应返回标签规则', async () => {
      const token = server.getToken()
      const res = await fetch(`${baseUrl}/api/tags`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('getToken', () => {
    it('应返回非空 token', () => {
      const token = server.getToken()
      expect(token).toBeTruthy()
      expect(token.length).toBeGreaterThan(16)
    })
  })
})
