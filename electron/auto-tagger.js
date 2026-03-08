class AutoTagger {
  constructor(rules) {
    this.rules = rules || []
  }

  analyze(title, content) {
    const text = `${title} ${content}`.toLowerCase()
    const matchedTags = []
    let matchedCategory = ''

    for (const rule of this.rules) {
      const hit = rule.keywords.some(kw => text.includes(kw.toLowerCase()))
      if (hit) {
        for (const tag of rule.tags) {
          if (!matchedTags.includes(tag)) {
            matchedTags.push(tag)
          }
        }
        // 取第一个匹配的 category
        if (!matchedCategory) {
          matchedCategory = rule.category
        }
      }
    }

    if (matchedTags.length === 0) {
      return { tags: ['未分类'], category: 'Inbox' }
    }

    return { tags: matchedTags, category: matchedCategory }
  }

  generateFrontmatter(note) {
    const { tags: autoTags, category } = this.analyze(note.title, note.content)
    const customTags = note.customTags || []

    // 合并自动标签和自定义标签，去重
    const allTags = [...autoTags]
    for (const t of customTags) {
      if (!allTags.includes(t)) allTags.push(t)
    }

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toISOString().split('.')[0].replace('T', ' ')

    const lines = ['---']
    lines.push(`title: "${note.title.replace(/"/g, '\\"')}"`)
    lines.push(`date: ${dateStr}`)
    lines.push(`created: ${timeStr}`)
    lines.push(`type: ${note.type}`)
    lines.push(`category: ${category}`)
    lines.push(`tags: [${allTags.join(', ')}]`)

    if (note.source) {
      lines.push(`source: ${note.source}`)
    }

    lines.push('---')
    lines.push('')

    return lines.join('\n')
  }
}

module.exports = { AutoTagger }
