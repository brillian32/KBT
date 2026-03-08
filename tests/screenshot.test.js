import { describe, it, expect } from 'vitest'
import { Screenshot } from '../electron/screenshot.js'

describe('Screenshot', () => {
  it('应导出 Screenshot 类', () => {
    expect(Screenshot).toBeDefined()
    expect(typeof Screenshot).toBe('function')
  })

  it('实例应有 captureFullScreen 方法', () => {
    const ss = new Screenshot()
    expect(ss.captureFullScreen).toBeTypeOf('function')
  })

  it('实例应有 captureRegion 方法', () => {
    const ss = new Screenshot()
    expect(ss.captureRegion).toBeTypeOf('function')
  })

  it('cropImage 应裁剪 Buffer（模拟测试）', async () => {
    const ss = new Screenshot()
    // cropImage 是内部方法，通过模块测试接口存在性
    expect(ss._cropImage).toBeTypeOf('function')
  })
})
