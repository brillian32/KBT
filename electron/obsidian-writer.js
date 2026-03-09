const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class ObsidianWriter {
  constructor(config) {
    this.vaultPath = config.vaultPath
    this.directories = config.directories
    this.useApi = config.useApi || false
    this.apiUrl = config.apiUrl || ''
    this.apiToken = config.apiToken || ''
  }

  _sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim()
  }

  _getDirForType(type) {
    const t = (type || '').toLowerCase()
    const map = {
      webclip: this.directories.webClips,
      screenshot: this.directories.screenshots,
      text: this.directories.textNotes,
      inspiration: this.directories.textNotes,
      todo: this.directories.textNotes,
      note: this.directories.textNotes,
    }
    return map[t] || this.directories.textNotes
  }

  _getUniquePath(filePath) {
    if (!fs.existsSync(filePath)) return filePath

    const dir = path.dirname(filePath)
    const ext = path.extname(filePath)
    const base = path.basename(filePath, ext)

    let counter = 1
    let newPath
    do {
      newPath = path.join(dir, `${base}_${counter}${ext}`)
      counter++
    } while (fs.existsSync(newPath))

    return newPath
  }

  async writeViaFile(note) {
    const subDir = this._getDirForType(note.type)
    const fullDir = path.join(this.vaultPath, subDir)

    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true })
    }

    const safeTitle = this._sanitizeFilename(note.title)
    let filePath = path.join(fullDir, `${safeTitle}.md`)
    filePath = this._getUniquePath(filePath)

    const content = (note.frontmatter || '') + note.content
    fs.writeFileSync(filePath, content, 'utf-8')

    return filePath
  }

  async writeViaApi(note) {
    const notePath = path.join(this._getDirForType(note.type), this._sanitizeFilename(note.title) + '.md')
    const content = (note.frontmatter || '') + note.content

    const url = `${this.apiUrl}/vault/${encodeURIComponent(notePath)}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/markdown',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: content,
    })

    if (!response.ok) {
      throw new Error(`Obsidian API 写入失败: ${response.status}`)
    }

    return path.join(this.vaultPath, notePath)
  }

  async checkApiAvailable() {
    if (!this.apiUrl || !this.apiToken) return false

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const response = await fetch(`${this.apiUrl}/`, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response.ok
    } catch {
      return false
    }
  }

  async saveImage(imageBuffer, filename) {
    const assetsDir = path.join(this.vaultPath, this.directories.assets)
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true })
    }

    const filePath = path.join(assetsDir, filename)
    fs.writeFileSync(filePath, imageBuffer)

    return filePath
  }

  // 从 URL 推断图片扩展名，Content-Type 优先，其次 URL 路径，回退 .jpg
  _getImgExt(url, contentType) {
    const ctMap = {
      'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
      'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg',
      'image/avif': '.avif', 'image/bmp': '.bmp',
    }
    if (contentType) {
      const ct = contentType.split(';')[0].trim().toLowerCase()
      if (ctMap[ct]) return ctMap[ct]
    }
    const urlPath = url.split('?')[0].split('#')[0]
    const ext = path.extname(urlPath).toLowerCase()
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp']
    return allowed.includes(ext) ? ext : '.jpg'
  }

  // 下载 URL，使用 Node.js https 原生模块，完全绕过 Chromium 网络栈避免 ERR_BLOCKED_BY_CLIENT
  // referer 用于绕过防盗链
  _fetchUrl(url, redirects = 0, referer = '') {
    return new Promise((resolve, reject) => {
      if (redirects > 5) return reject(new Error('重定向过多: ' + url))
      const parsedUrl = new URL(url)
      const mod = parsedUrl.protocol === 'https:' ? require('https') : require('http')
      const refererVal = referer ? referer.split('?')[0] : url

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': refererVal,
        },
        timeout: 20000,
      }

      const req = mod.request(options, res => {
        console.log(`[KBT] 图片响应 ${res.statusCode}: ${url}`)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          const loc = res.headers.location
          const absolute = loc.startsWith('http') ? loc : new URL(loc, url).href
          return this._fetchUrl(absolute, redirects + 1, referer).then(resolve).catch(reject)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        }
        const contentType = res.headers['content-type'] || ''
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          console.log(`[KBT] 图片下载完成 ${url}, size=${buffer.length}, ct=${contentType}`)
          resolve({ buffer, contentType })
        })
        res.on('error', reject)
      })
      req.on('error', err => {
        console.warn(`[KBT] 图片请求错误 ${url}: ${err.message}`)
        reject(err)
      })
      req.on('timeout', () => { req.destroy(); reject(new Error('下载超时: ' + url)) })
      req.end()
    })
  }

  // 扫描 markdown 中的 http(s) 图片链接，下载到 assets 目录并替换为 Obsidian wiki-link
  // referer：来源页面 URL，用于绕过防盗链
  async _downloadImages(content, referer = '') {
    const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g
    const urlToFilename = new Map()
    let match
    while ((match = imgRegex.exec(content)) !== null) {
      const imgUrl = match[2]
      if (!urlToFilename.has(imgUrl)) {
        const hash = crypto.createHash('md5').update(imgUrl).digest('hex').slice(0, 10)
        urlToFilename.set(imgUrl, hash)
      }
    }

    if (urlToFilename.size === 0) return content

    console.log(`[KBT] _downloadImages: 发现 ${urlToFilename.size} 张图片, referer=${referer}`)
    // 优先保存在 vaultPath/assets；vaultPath 为空时用工作目录下的 assets（API 模式兜底）
    const baseDir = this.vaultPath || '.'
    const assetsDir = path.join(baseDir, this.directories.assets || 'assets')
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

    const downloaded = new Map()
    for (const [imgUrl, hash] of urlToFilename) {
      try {
        console.log(`[KBT] 开始下载图片: ${imgUrl}`)
        const { buffer, contentType } = await this._fetchUrl(imgUrl, 0, referer)
        const ext = this._getImgExt(imgUrl, contentType)
        const filename = `img_${hash}${ext}`
        const filePath = path.join(assetsDir, filename)
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, buffer)
        }
        downloaded.set(imgUrl, filename)
        console.log(`[KBT] 图片已保存: ${filePath}`)
      } catch (err) {
        console.warn(`[KBT] 图片下载失败 ${imgUrl}: ${err.message}`)
        // 下载失败则保留原始 URL，不中断整体保存流程
      }
    }

    return content.replace(imgRegex, (full, alt, imgUrl) => {
      const filename = downloaded.get(imgUrl)
      return filename ? `![[${filename}]]` : full
    })
  }

  async write(note) {
    try {
      console.log(`[KBT] write() 开始, title=${note.title}, source=${note.source}, contentLen=${(note.content||'').length}`)
      note = { ...note, content: await this._downloadImages(note.content || '', note.source || '') }

      if (this.useApi) {
        const apiOk = await this.checkApiAvailable()
        if (apiOk) {
          const p = await this.writeViaApi(note)
          return { success: true, path: p, method: 'api' }
        }
      }
      // fallback 到文件写入
      const p = await this.writeViaFile(note)
      return { success: true, path: p, method: 'file' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

module.exports = { ObsidianWriter }
