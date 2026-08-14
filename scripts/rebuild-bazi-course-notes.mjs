import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const courseRoot = '/Users/zhengweizhi/Documents/Nexus 待處理課程/86｜掌握時運，洞見先機｜徐玉蘭的人生八字應用課'
const notesRoot = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫/86｜掌握時運，洞見先機｜徐玉蘭的人生八字應用課/01｜單元筆記'
const dryRun = process.argv.includes('--dry-run')

function walk(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function cues(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').split('\n')
  const result = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\d{2}:\d{2}:\d{2})[.,]\d{3}\s+-->\s+(\d{2}:\d{2}:\d{2})/)
    if (!match) continue
    const text = []
    while (++index < lines.length && lines[index].trim()) text.push(lines[index].replace(/<[^>]+>/g, '').trim())
    if (text.length) result.push({ start: match[1], end: match[2], text: text.join(' ').replace(/\s+/g, ' ').trim() })
  }
  return result
}

function seconds(value) { const [hour, minute, second] = value.split(':').map(Number); return hour * 3600 + minute * 60 + second }
function clean(value) { return value.replace(/^(那|所以|就是|其實|然後)[，、\s]*/g, '').replace(/\s+/g, ' ').trim() }
function shorten(value, limit = 104) { const text = clean(value); return text.length > limit ? `${text.slice(0, limit)}…` : text }
function insight(value) {
  const text = clean(value)
  const rules = [
    [/過去.*?經驗.*?定盤/, '可用過去幾年的實際經驗重新定盤，作為校正判斷的依據。'],
    [/講義.*?(?:查表|對照)|查表.*?(?:講義|使用)/, '天干地支的互動可先搭配講義查表，建立基本判讀。'],
    [/日主.*?土.*?(?:戌|土庫)/, '日主為土時，講者以「戌可作土庫」示範課內判讀方式。'],
    [/風水.*?(?:系統|佈局)/, '涉及風水佈局時，應依該系統的判讀規則，避免與八字用法混用。'],
    [/(?:三合|三會).*?(?:四庫|地支)|四庫.*?(?:三合|三會|地支)/, '四庫需連同盤上其他地支，並考量三合、三會的互動後再判斷。'],
    [/身強.*?身弱/, '身強、身弱的判斷要回到整體命盤與已發生經驗，不宜只憑單一條件下結論。'],
    [/五行.*?(?:平衡|過多|不足)/, '五行的判讀要看整體分布與平衡，不以單一元素直接推論。'],
    [/大運.*?流年|流年.*?大運/, '流年需要放在大運與命盤脈絡中一起看，才能理解當年的變化。'],
    [/命盤.*?(?:輸入|教具|系統)/, '可使用課程的命盤／教具系統輔助輸入與查看，降低初學判讀門檻。'],
    [/先.*?再/, `講者的操作順序是：${shorten(text, 86)}`],
  ]
  const matched = rules.find(([pattern]) => pattern.test(text))
  return matched ? matched[1] : shorten(text, 82)
}

function chunks(items) {
  const result = []; let buffer = ''; let start = ''; let end = ''
  for (const item of items) {
    if (!start) start = item.start
    buffer += item.text
    end = item.end
    if (/[。！？!?]$/.test(item.text) || buffer.length >= 86) {
      if (buffer.length >= 24) result.push({ start, end, text: clean(buffer) })
      buffer = ''; start = ''; end = ''
    }
  }
  if (buffer.length >= 24) result.push({ start, end, text: clean(buffer) })
  return result
}

const glossary = ['日主', '身強', '身弱', '五行', '天干', '地支', '十神', '格局', '用神', '大運', '流年', '命盤', '合', '沖', '刑', '財星', '官星', '印星', '食傷', '比劫']
const teachingWords = ['重點', '關鍵', '代表', '意思', '原因', '所以', '因為', '先', '再', '要', '記得', '可以', '建議', '看', '判斷', '分析', '平衡', '強弱', '關係', '方法']
const noise = /^(大家好|聽得到|等一下|謝謝|晚安|哈囉|直播|工程師|音量|畫面)|聊天室|抽獎|優惠|上課時間/

function score(chunk, title) {
  if (noise.test(chunk.text)) return -20
  const titleTerms = title.split(/[｜、（）()【】\s]/).filter(value => value.length >= 2)
  return teachingWords.reduce((total, word) => total + (chunk.text.includes(word) ? 2 : 0), 0)
    + glossary.reduce((total, word) => total + (chunk.text.includes(word) ? 2 : 0), 0)
    + titleTerms.reduce((total, word) => total + (chunk.text.includes(word) ? 3 : 0), 0)
    + (chunk.text.length >= 42 && chunk.text.length <= 155 ? 2 : 0)
}

function selectHighlights(source, title) {
  const ranked = source.map(item => ({ ...item, score: score(item, title) })).filter(item => item.score > 2).sort((a, b) => b.score - a.score)
  const selected = []
  for (const item of ranked) {
    if (selected.every(existing => Math.abs(seconds(existing.start) - seconds(item.start)) >= 24)) selected.push(item)
    if (selected.length === 5) break
  }
  return selected.sort((a, b) => seconds(a.start) - seconds(b.start))
}

function selectConcepts(source, title) {
  const concepts = []
  for (const term of glossary) {
    const matched = source.filter(item => item.text.includes(term) && !noise.test(item.text)).sort((a, b) => score(b, title) - score(a, title))[0]
    if (matched) concepts.push(`${term}：${shorten(matched.text, 78)}`)
    if (concepts.length === 5) break
  }
  return concepts
}

function selectSteps(source, title) {
  return source.filter(item => /(先|再|要|記得|建議|可以|不要)/.test(item.text) && !noise.test(item.text))
    .sort((a, b) => score(b, title) - score(a, title)).slice(0, 3).map(item => shorten(item.text, 100))
}

function section(markdown, heading, body) {
  const match = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(markdown)
  const replacement = `## ${heading}\n\n${body.trim()}\n`
  if (!match) return `${markdown.trim()}\n\n${replacement}`
  const start = match.index
  const next = /^##\s+/m.exec(markdown.slice(match.index + match[0].length))
  const end = next ? match.index + match[0].length + next.index : markdown.length
  return `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`
}

const captionPaths = walk(courseRoot).filter(path => path.endsWith('_字幕潤飾版.vtt'))
const captions = new Map(captionPaths.map(path => [basename(path).replace(/_字幕潤飾版\.vtt$/, ''), path]))
let updated = 0
for (const noteName of readdirSync(notesRoot).filter(name => name.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'zh-Hant'))) {
  const notePath = join(notesRoot, noteName)
  const lessonTitle = noteName.replace(/\.md$/, '')
  const captionPath = captions.get(lessonTitle)
  if (!captionPath) { console.log(`找不到字幕：${lessonTitle}`); continue }
  const source = chunks(cues(captionPath))
  const highlights = selectHighlights(source, lessonTitle)
  const concepts = selectConcepts(source, lessonTitle)
  const steps = selectSteps(source, lessonTitle)
  const conciseConcepts = concepts.map(concept => {
    const [term, excerpt] = concept.split(/：(.+)/)
    const description = insight(excerpt)
    return description.includes(term) ? `${term}：${description}` : null
  }).filter(Boolean)
  const hasTeachingTool = source.some(item => /教具|系統|輸入命盤|排盤/.test(item.text))
  const keyPoints = [...new Set(highlights.map(item => insight(item.text)))]
  let markdown = readFileSync(notePath, 'utf8').replace(/\r/g, '')
  markdown = markdown.replace(/^status:\s*.*$/m, 'status: 內容筆記完成（字幕整理）')
  markdown = section(markdown, '這一課在教什麼？', `本單元聚焦「${lessonTitle}」。以下整理講者在課程中提出的重點與學習方法，並保留對應時間碼；內容為講者的課程觀點，不作為個人健康、財務或人生決策建議。`)
  markdown = section(markdown, '重點整理', keyPoints.length ? keyPoints.map(point => `- ${point}`).join('\n') : '- 本單元未偵測到足以獨立整理的重點，請直接回查完整字幕。')
  markdown = section(markdown, '關鍵概念', conciseConcepts.length ? conciseConcepts.map(concept => `- ${concept}`).join('\n') : '- 本單元以課程問答與說明為主，沒有額外抽出概念定義。')
  markdown = section(markdown, '實作步驟', steps.length ? steps.map((step, index) => `${index + 1}. ${insight(step)}`).join('\n') : '- 本單元沒有獨立的操作步驟；請依重點時間碼回查講者說明。')
  markdown = section(markdown, '工具／應用程式', hasTeachingTool ? '- 課程命盤／教具系統：講者提及可直接輸入命盤、協助查看身強身弱。' : '- 本單元沒有可確認的外部工具操作。')
  markdown = section(markdown, '來源時間碼', highlights.length ? highlights.map(item => `- \`${item.start}–${item.end}\`：${insight(item.text)}`).join('\n') : '- 未選出足以獨立標示的重點時間碼。')
  if (!dryRun) writeFileSync(notePath, `${markdown.trim()}\n`, 'utf8')
  updated += 1
  console.log(`${dryRun ? '預覽' : '已更新'}：${lessonTitle}（${highlights.length} 個重點）`)
}
console.log(`${dryRun ? '預覽完成' : '完成'}：${updated} 則單元筆記；字幕檔未被修改。`)
