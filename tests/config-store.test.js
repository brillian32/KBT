import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConfigStore, createConfigStore, defaultConfig } from '../electron/config-store.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

let configPath
let store

beforeEach(() => {
  // 每次测试使用独立临时文件
  configPath = path.join(os.tmpdir(), `kbt-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  store = createConfigStore(configPath)
})

afterEach(() => {
  try { fs.unlinkSync(configPath) } catch {}
})

describe('ConfigStore', () => {
  it('应返回 store 实例', () => {
    expect(store).toBeDefined()
    expect(store.get).toBeTypeOf('function')
    expect(store.set).toBeTypeOf('function')
  })

  it('应有默认的 Obsidian 配置', () => {
    expect(store.get('obsidian.vaultPath')).toBe('')
    expect(store.get('obsidian.useApi')).toBe(true)
  })

  it('应有默认的目录配置', () => {
    expect(store.get('directories.webClips')).toBe('Inbox/WebClips')
    expect(store.get('directories.screenshots')).toBe('Inbox/Screenshots')
    expect(store.get('directories.textNotes')).toBe('Inbox/TextNotes')
    expect(store.get('directories.assets')).toBe('assets')
  })

  it('应有默认的快捷键配置', () => {
    expect(store.get('shortcuts.screenshotFull')).toBe('Ctrl+Shift+K')
    expect(store.get('shortcuts.screenshotRegion')).toBe('Ctrl+Shift+A')
  })

  it('应有默认的服务器配置', () => {
    expect(store.get('server.port')).toBe(18321)
  })

  it('应有默认的标签规则', () => {
    const rules = store.get('tagRules')
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]).toHaveProperty('keywords')
    expect(rules[0]).toHaveProperty('tags')
    expect(rules[0]).toHaveProperty('category')
  })

  it('应能修改并读取配置', () => {
    store.set('obsidian.vaultPath', 'C:/MyVault')
    expect(store.get('obsidian.vaultPath')).toBe('C:/MyVault')
  })

  it('修改后应持久化到文件', () => {
    store.set('server.port', 9999)
    // 重新从文件加载
    const store2 = createConfigStore(configPath)
    expect(store2.get('server.port')).toBe(9999)
  })

  it('配置文件损坏时应回退到默认值', () => {
    fs.writeFileSync(configPath, '{ invalid json !!!', 'utf-8')
    const store2 = createConfigStore(configPath)
    expect(store2.get('server.port')).toBe(18321)
  })

  it('getAll 应返回完整配置的深拷贝', () => {
    const all = store.getAll()
    expect(all.obsidian.vaultPath).toBe('')
    // 修改返回值不影响 store 内部
    all.obsidian.vaultPath = 'changed'
    expect(store.get('obsidian.vaultPath')).toBe('')
  })
})
