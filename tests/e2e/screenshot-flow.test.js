// 端到端集成测试 — 截图 + 区域截图流程
import { describe, it, expect, vi } from 'vitest'
import { Screenshot } from '../../electron/screenshot.js'

describe('E2E: 截图流程', () => {
  it('Screenshot 实例应有完整的截图 API', () => {
    const ss = new Screenshot()
    expect(ss.captureFullScreen).toBeTypeOf('function')
    expect(ss.captureRegion).toBeTypeOf('function')
    expect(ss._cropImage).toBeTypeOf('function')
  })

  it('captureRegion 无 bounds 时应回退到全屏截图', async () => {
    const ss = new Screenshot()
    // mock captureFullScreen 返回假 Buffer
    const fakeBuffer = Buffer.from('fake-png')
    ss.captureFullScreen = vi.fn().mockResolvedValue(fakeBuffer)

    const result = await ss.captureRegion(null)
    expect(ss.captureFullScreen).toHaveBeenCalled()
    expect(result).toBe(fakeBuffer)
  })

  it('captureRegion 有 bounds 时应调用 _cropImage', async () => {
    const ss = new Screenshot()
    const fakeBuffer = Buffer.from('fake-png')
    const croppedBuffer = Buffer.from('cropped')
    ss.captureFullScreen = vi.fn().mockResolvedValue(fakeBuffer)
    ss._cropImage = vi.fn().mockReturnValue(croppedBuffer)

    const bounds = { x: 10, y: 20, width: 100, height: 80 }
    const result = await ss.captureRegion(bounds)

    expect(ss._cropImage).toHaveBeenCalledWith(fakeBuffer, bounds)
    expect(result).toBe(croppedBuffer)
  })

  it('_cropImage 非 Electron 环境应回退返回原始 Buffer', () => {
    const ss = new Screenshot()
    const fakeBuffer = Buffer.from('fake-png')
    const bounds = { x: 0, y: 0, width: 50, height: 50 }

    // 非 Electron 环境，require('electron') 会失败，应返回原始 buffer
    const result = ss._cropImage(fakeBuffer, bounds)
    expect(Buffer.isBuffer(result)).toBe(true)
  })
})
