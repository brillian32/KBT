const fs = require('fs')
const path = require('path')

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
    const map = {
      webClip: this.directories.webClips,
      screenshot: this.directories.screenshots,
      text: this.directories.textNotes,
    }
    return map[type] || this.directories.textNotes
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

  async write(note) {
    try {
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
