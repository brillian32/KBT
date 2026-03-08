// 截图模块 — 依赖 Electron desktopCapturer API
// 在 Electron 主进程中调用

class Screenshot {
  constructor() {
    this._desktopCapturer = null
    this._screen = null
  }

  _getElectronModules() {
    if (!this._desktopCapturer) {
      try {
        const { desktopCapturer, screen } = require('electron')
        this._desktopCapturer = desktopCapturer
        this._screen = screen
      } catch {
        // 非 Electron 环境
      }
    }
    return { desktopCapturer: this._desktopCapturer, screen: this._screen }
  }

  async captureFullScreen() {
    const { desktopCapturer, screen } = this._getElectronModules()
    if (!desktopCapturer) {
      throw new Error('截图功能仅在 Electron 环境中可用')
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size
    const scaleFactor = primaryDisplay.scaleFactor || 1

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor),
      },
    })

    if (sources.length === 0) {
      throw new Error('未找到屏幕源')
    }

    // 取主屏幕
    const source = sources[0]
    const image = source.thumbnail
    return image.toPNG()
  }

  async captureRegion(bounds) {
    const fullScreenBuffer = await this.captureFullScreen()
    if (!bounds) return fullScreenBuffer
    return this._cropImage(fullScreenBuffer, bounds)
  }

  _cropImage(pngBuffer, bounds) {
    // 使用 Electron 的 nativeImage 裁剪
    try {
      const { nativeImage } = require('electron')
      const image = nativeImage.createFromBuffer(pngBuffer)
      const cropped = image.crop(bounds)
      return cropped.toPNG()
    } catch {
      // 非 Electron 环境回退
      return pngBuffer
    }
  }
}

module.exports = { Screenshot }
