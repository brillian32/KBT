import { describe, it, expect, beforeEach } from 'vitest'
import { AutoTagger } from '../electron/auto-tagger.js'

const testRules = [
  { keywords: ['JavaScript', 'TypeScript', 'Node.js'], tags: ['JavaScript'], category: '编程/JavaScript' },
  { keywords: ['React', 'Vue', 'Angular'], tags: ['前端框架'], category: '编程/前端' },
  { keywords: ['Python', 'Django', 'Flask'], tags: ['Python'], category: '编程/Python' },
  { keywords: ['Docker', 'Kubernetes', 'K8s'], tags: ['容器化'], category: '运维/容器' },
]

let tagger

describe('AutoTagger', () => {
  beforeEach(() => {
    tagger = new AutoTagger(testRules)
  })

  describe('analyze', () => {
    it('含 JavaScript 关键词应匹配 JavaScript 规则', () => {
      const result = tagger.analyze('学习笔记', 'JavaScript 异步编程入门教程')
      expect(result.tags).toContain('JavaScript')
      expect(result.category).toBe('编程/JavaScript')
    })

    it('标题中的关键词也应被识别', () => {
      const result = tagger.analyze('Vue3 组合式 API 指南', '组件开发技巧')
      expect(result.tags).toContain('前端框架')
      expect(result.category).toBe('编程/前端')
    })

    it('无匹配时应返回未分类', () => {
      const result = tagger.analyze('随便写写', '今天天气不错')
      expect(result.tags).toEqual(['未分类'])
      expect(result.category).toBe('Inbox')
    })

    it('多规则同时命中应合并标签', () => {
      const result = tagger.analyze('全栈项目', '使用 React 和 Node.js 构建全栈应用')
      expect(result.tags).toContain('JavaScript')
      expect(result.tags).toContain('前端框架')
    })

    it('关键词匹配应忽略大小写', () => {
      const result = tagger.analyze('笔记', '学习 python 数据处理')
      expect(result.tags).toContain('Python')
    })
  })

  describe('generateFrontmatter', () => {
    it('应生成有效的 YAML frontmatter', () => {
      const note = {
        title: '测试笔记',
        content: 'JavaScript 学习笔记',
        type: 'text',
        source: '',
      }

      const fm = tagger.generateFrontmatter(note)
      expect(fm).toMatch(/^---\n/)
      expect(fm).toMatch(/\n---\n$/)
      expect(fm).toContain('tags:')
      expect(fm).toContain('date:')
    })

    it('webClip 类型应包含 source 字段', () => {
      const note = {
        title: 'Web文章',
        content: 'Python 教程',
        type: 'webClip',
        source: 'https://example.com/article',
      }

      const fm = tagger.generateFrontmatter(note)
      expect(fm).toContain('source: https://example.com/article')
      expect(fm).toContain('type: webClip')
    })

    it('screenshot 类型应包含 type 字段', () => {
      const note = {
        title: '截图',
        content: '截图备注',
        type: 'screenshot',
      }

      const fm = tagger.generateFrontmatter(note)
      expect(fm).toContain('type: screenshot')
    })

    it('自定义标签应与自动标签合并', () => {
      const note = {
        title: '笔记',
        content: 'React 组件模式',
        type: 'text',
        customTags: ['设计模式', '最佳实践'],
      }

      const fm = tagger.generateFrontmatter(note)
      expect(fm).toContain('前端框架')
      expect(fm).toContain('设计模式')
      expect(fm).toContain('最佳实践')
    })
  })
})
