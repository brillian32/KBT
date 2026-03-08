const express = require('express')
const cors = require('cors')
const crypto = require('crypto')

class HttpServer {
  constructor(port, obsidianWriter, autoTagger) {
    this.port = port
    this.writer = obsidianWriter
    this.tagger = autoTagger
    this.token = crypto.randomBytes(32).toString('hex')
    this.server = null

    this.app = express()
    this._setupMiddleware()
    this._setupRoutes()
  }

  getToken() {
    return this.token
  }

  _setupMiddleware() {
    this.app.use(cors({
      origin: /^(chrome-extension|http:\/\/localhost)/,
      methods: ['GET', 'POST'],
    }))
    this.app.use(express.json({ limit: '10mb' }))
  }

  _authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '缺少认证 token' })
    }

    const reqToken = authHeader.slice(7)
    const tokenBuf = Buffer.from(this.token)
    const reqBuf = Buffer.from(reqToken)
    if (tokenBuf.length !== reqBuf.length || !crypto.timingSafeEqual(reqBuf, tokenBuf)) {
      return res.status(401).json({ error: 'token 无效' })
    }

    next()
  }

  _setupRoutes() {
    // 健康检查 — 不需要鉴权
    this.app.get('/api/ping', (_req, res) => {
      res.json({ status: 'ok', version: '1.0.0' })
    })

    // 网页采集
    this.app.post('/api/clip', this._authMiddleware.bind(this), async (req, res) => {
      try {
        const { title, content, url, type, tags } = req.body
        const note = {
          title: title || '未命名',
          content: content || '',
          type: type || 'webClip',
          source: url || '',
          customTags: tags || [],
        }

        note.frontmatter = this.tagger.generateFrontmatter(note)
        const result = await this.writer.write(note)
        res.json(result)
      } catch (err) {
        res.status(500).json({ success: false, error: err.message })
      }
    })

    // 文本入库
    this.app.post('/api/text', this._authMiddleware.bind(this), async (req, res) => {
      try {
        const { title, content, tags } = req.body
        const note = {
          title: title || '未命名',
          content: content || '',
          type: 'text',
          customTags: tags || [],
        }

        note.frontmatter = this.tagger.generateFrontmatter(note)
        const result = await this.writer.write(note)
        res.json(result)
      } catch (err) {
        res.status(500).json({ success: false, error: err.message })
      }
    })

    // 获取标签规则
    this.app.get('/api/tags', this._authMiddleware.bind(this), (_req, res) => {
      res.json({ rules: this.tagger.rules || [] })
    })
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        resolve()
      })
      this.server.on('error', reject)
    })
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve)
      } else {
        resolve()
      }
    })
  }
}

module.exports = { HttpServer }
