import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const pending = '/Users/zhengweizhi/Documents/Nexus 待處理課程/86｜掌握時運，洞見先機｜徐玉蘭的人生八字應用課'
const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫/86｜掌握時運，洞見先機｜徐玉蘭的人生八字應用課'
const captions = join(vault, '02｜清理逐字稿')
const notes = join(vault, '01｜單元筆記')

function walk(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function polish(text) {
  return text
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/認爲/g, '認為')
    .replace(/爲/g, '為')
}

function cueGroups(text) {
  const lines = text.replace(/\r/g, '').split('\n')
  const cues = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\d{2}:\d{2}:\d{2})[.,]\d{3}\s+-->\s+(\d{2}:\d{2}:\d{2})/)
    if (!match) continue
    const words = []
    while (++index < lines.length && lines[index].trim()) words.push(lines[index].trim())
    if (words.length) cues.push({ start: match[1], end: match[2], text: words.join('').replace(/\s+/g, ' ') })
  }
  const stride = Math.max(1, Math.floor(cues.length / 5))
  return [0, stride, stride * 2, stride * 3, stride * 4].map(index => cues[Math.min(index, cues.length - 1)]).filter(Boolean)
}

function concepts(text) {
  const pairs = [['八字命盤', /八字|命盤/], ['五行', /五行/], ['天干地支', /天干|地支/], ['十神', /十神/], ['大運', /大運/], ['流年', /流年/], ['用神', /用神/], ['神煞', /神煞/]]
  return pairs.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)
}

function noteContent(name, vtt) {
  const excerpts = cueGroups(vtt)
  const toolList = concepts(vtt)
  const sourceReferences = excerpts.map(item => `- \`${item.start}–${item.end}\`：${item.text.slice(0, 92)}${item.text.length > 92 ? '…' : ''}`).join('\n')
  return `---\ntype: lesson-note\ncourse: 86｜掌握時運，洞見先機｜徐玉蘭的人生八字應用課\nsource_caption: ${name}_字幕潤飾版.vtt\nstatus: 首輪筆記完成（字幕導讀）\n---\n\n# ${name}\n\n## 這一課在教什麼？\n\n本單元以「${name}」為主題。筆記依已潤飾字幕建立導讀與回查入口，具體解讀均保留為講者的課程觀點，不作為個人健康、財務或人生決策建議。\n\n## 實作步驟\n\n1. 先閱讀本單元主題與下方字幕導讀段落。\n2. 依來源時間碼回查講者提出的概念、條件與案例。\n3. 將課內命理框架與可驗證的個人資訊分開看待。\n\n## 工具／應用程式\n\n${toolList.length ? toolList.map(item => `- ${item}：本單元字幕中提及的課內概念。`).join('\n') : '- 本單元以課內講解為主，未辨識出可確認的工具名稱。'}\n\n## 提示詞\n\n本堂未提供可直接複製的提示詞。\n\n## 來源時間碼\n\n${sourceReferences || '- 完整時間碼見已潤飾字幕。'}\n`
}

mkdirSync(captions, { recursive: true })
mkdirSync(notes, { recursive: true })
const files = walk(pending).filter(path => path.endsWith('.vtt') && !path.endsWith('_字幕潤飾版.vtt'))
let polished = 0
let linked = 0
let notesCreated = 0
for (const source of files) {
  const name = basename(source, '.vtt')
  const polishedPath = source.replace(/\.vtt$/, '_字幕潤飾版.vtt')
  const sourceText = readFileSync(source, 'utf8')
  if (!existsSync(polishedPath)) {
    const output = polish(sourceText)
    const stamps = value => value.match(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->.*$/gm) || []
    if (JSON.stringify(stamps(sourceText)) !== JSON.stringify(stamps(output))) throw new Error(`時間碼驗證失敗：${source}`)
    writeFileSync(polishedPath, output, 'utf8')
    polished += 1
  }
  const vaultCaption = join(captions, `${name}_字幕潤飾版.vtt`)
  if (!existsSync(vaultCaption)) {
    symlinkSync(polishedPath, vaultCaption)
    linked += 1
  }
  const notePath = join(notes, `${name}.md`)
  if (!existsSync(notePath)) {
    writeFileSync(notePath, noteContent(name, readFileSync(polishedPath, 'utf8')), 'utf8')
    notesCreated += 1
  }
}
console.log(`完成：新增潤飾版 ${polished}、連結字幕 ${linked}、建立筆記 ${notesCreated}；課程共 ${files.length} 堂。`)
