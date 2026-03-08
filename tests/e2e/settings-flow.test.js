// 端到端集成测试 — 设置修改 → 持久化 → 恢复
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ConfigStore } from '../../electron/config-store.js'

describe('E2E: 设置修改 → 持久化 → 重启恢复', () => {
  let configPath
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbt-e2e-'))
    configPath = path.join(tmpDir, 'config.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('修改设置后持久化，新实例能读取', () => {
    // 第一个实例 — 修改设置
    const store1 = new ConfigStore(configPath)
    store1.set('obsidian.vaultPath', 'D:/MyVault')
    store1.set('obsidian.useApi', false)
    store1.set('server.port', 9999)

    // 验证文件已写入
    expect(fs.existsSync(configPath)).toBe(true)

    // 第二个实例 — 模拟重启
    const store2 = new ConfigStore(configPath)
    expect(store2.get('obsidian.vaultPath')).toBe('D:/MyVault')
    expect(store2.get('obsidian.useApi')).toBe(false)
    expect(store2.get('server.port')).toBe(9999)

    // 其他默认值应保留
    expect(store2.get('obsidian.apiUrl')).toBe('https://localhost:27124')
    expect(store2.get('directories.webClips')).toBe('Inbox/WebClips')
  })

  it('损坏的配置文件回退到默认值', () => {
    // 写入损坏的 JSON
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, '{invalid json!!!', 'utf-8')

    const store = new ConfigStore(configPath)
    // 应回退到默认值
    expect(store.get('obsidian.vaultPath')).toBe('')
    expect(store.get('server.port')).toBe(18321)
  })

  it('标签规则修改后持久化', () => {
    const store1 = new ConfigStore(configPath)
    const newRules = [
      { keywords: ['Rust', 'Cargo'], tags: ['Rust'], category: '编程/Rust' },
    ]
    store1.set('tagRules', newRules)

    const store2 = new ConfigStore(configPath)
    const rules = store2.get('tagRules')
    expect(rules).toHaveLength(1)
    expect(rules[0].keywords).toContain('Rust')
    expect(rules[0].tags).toContain('Rust')
  })
})
