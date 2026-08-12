import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const vaultCourses = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const suppliedPath = args.find(arg => !arg.startsWith('--'))
const targetFolders = suppliedPath ? [resolve(suppliedPath)] : readdirSync(vaultCourses, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(vaultCourses, entry.name))

const toolPatterns = [
  ['ChatGPT', /chat\s?gpt/ig], ['GPT', /\bGPT\b/g], ['Claude', /claude/ig], ['Codex', /codex/ig],
  ['Midjourney', /midjourney/ig], ['Sora', /\bsora\b/ig], ['Seedance', /seedance/ig], ['Runway', /runway/ig],
  ['可靈', /可靈/g], ['即夢', /即夢/g], ['剪映', /剪映|capcut/ig], ['Google', /google/ig],
  ['YouTube', /youtube/ig], ['小紅書', /小紅書/g], ['抖音', /抖音/g], ['Notion', /notion/ig], ['Obsidian', /obsidian/ig],
]

function cues(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').split('\n')
  const result = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\d{2}:\d{2}:\d{2})[.,]\d{3}\s+-->\s+(\d{2}:\d{2}:\d{2})/)
    if (!match) continue
    const text = []
    while (++i < lines.length && lines[i].trim()) text.push(lines[i].trim())
    if (text.length) result.push({ start: match[1], end: match[2], text: text.join(' ').replace(/<[^>]+>/g, '') })
  }
  return result
}

function sentences(items) {
  const chunks = []
  let buffer = ''
  let start = ''
  let end = ''
  for (const item of items) {
    if (!start) start = item.start
    buffer += item.text
    end = item.end
    if (/[。！？!?]$/.test(item.text) || buffer.length > 115) {
      const text = buffer.replace(/\s+/g, ' ').trim()
      if (text.length >= 18) chunks.push({ start, end, text })
      buffer = ''; start = ''; end = ''
    }
  }
  if (buffer.length >= 18) chunks.push({ start, end, text: buffer.replace(/\s+/g, ' ').trim() })
  return chunks
}

function score(item) {
  const terms = ['今天', '這堂', '課程', '流程', '方法', '步驟', '模型', '工具', '內容', '影片', '製作', '設定', '可以', '需要']
  return terms.reduce((total, term) => total + (item.text.includes(term) ? 1 : 0), 0) - (/(聽得到|大家好|等一下|直播|預告片|音量|上映|電影)/.test(item.text) ? 4 : 0)
}

const isUsefulSentence = item => item.text.length >= 20 && item.text.length <= 260 && !/(聽得到|大家好|等一下|預告片|音量|上映|電影|還有點時間)/.test(item.text)

function draft(items) {
  const source = sentences(items)
  const tools = toolPatterns.filter(([, pattern]) => source.some(item => { pattern.lastIndex = 0; return pattern.test(item.text) })).map(([name]) => name)
  const relevant = source.filter(isUsefulSentence).filter(item => score(item) > 1).sort((a, b) => score(b) - score(a)).slice(0, 5)
  const timeRanges = [...new Map(relevant.map(item => [`${item.start}–${item.end}`, item])).values()].map(item => `${item.start}–${item.end}`)
  return {
    tools,
    timeRanges,
  }
}

function sectionRange(markdown, heading) {
  const start = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(markdown)
  if (!start) return null
  const bodyStart = start.index + start[0].length
  const next = /^##\s+/m.exec(markdown.slice(bodyStart))
  return { start: bodyStart, end: next ? bodyStart + next.index : markdown.length, body: markdown.slice(bodyStart, next ? bodyStart + next.index : markdown.length).trim() }
}

function candidateBlock(generated) {
  const tools = generated.tools.length ? generated.tools.map(tool => `- ${tool}`).join('\n') : '- 未偵測到可確認的工具名稱。'
  const times = generated.timeRanges.length ? generated.timeRanges.map(range => `- ${range}`).join('\n') : '- 未偵測到可優先回查的時間碼。'
  return `## 自動整理候選（待校對）\n\n這是依字幕中的工具名稱與主題關鍵字建立的回查清單；不會自動覆寫正式筆記。\n\n### 字幕提及工具\n\n${tools}\n\n### 優先回查時間碼\n\n${times}\n\n`
}

let updated = 0
for (const courseFolder of targetFolders) {
  const transcriptFolder = join(courseFolder, '02｜清理逐字稿')
  const notesFolder = join(courseFolder, '01｜單元筆記')
  if (!existsSync(transcriptFolder) || !existsSync(notesFolder)) continue
  for (const file of readdirSync(transcriptFolder).filter(name => name.endsWith('_字幕潤飾版.vtt'))) {
    const name = file.replace(/_字幕潤飾版\.vtt$/, '')
    const notePath = join(notesFolder, `${name}.md`)
    if (!existsSync(notePath)) continue
    const generated = draft(cues(join(transcriptFolder, file)))
    const markdown = readFileSync(notePath, 'utf8')
    if (!/待從已潤飾字幕|待內容筆記整理|完整時間碼見字幕檔/.test(markdown)) continue
    const candidate = sectionRange(markdown, '自動整理候選（待校對）')
    const insertAt = /^##\s+字幕與來源\s*$/m.exec(markdown)?.index ?? markdown.length
    const updatedMarkdown = candidate
      ? `${markdown.slice(0, candidate.start - '## 自動整理候選（待校對）'.length)}${candidateBlock(generated)}${markdown.slice(candidate.end)}`
      : `${markdown.slice(0, insertAt)}${candidateBlock(generated)}${markdown.slice(insertAt)}`
    console.log(`${dryRun ? '預覽更新' : '更新初稿'}：${name}`)
    if (!dryRun) writeFileSync(notePath, updatedMarkdown, 'utf8')
    updated += 1
  }
}
console.log(`${dryRun ? '預覽' : '完成'}：${updated} 則單元筆記初稿。`)
