import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const requested = process.argv.find(value => !value.startsWith('--'))
const courseFolder = requested ? resolve(requested) : null
const placeholder = /待內容理解|待從|請完整閱讀|不要貼逐字稿|重點 1|00:00:00|字幕導讀|本單元聚焦/

function section(markdown, heading) {
  const match = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(markdown)
  if (!match) return ''
  const start = match.index + match[0].length
  const next = /^##\s+/m.exec(markdown.slice(start))
  return markdown.slice(start, next ? start + next.index : markdown.length).trim()
}

function list(body) { return body.split('\n').map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()).filter(Boolean) }

const folders = courseFolder ? [courseFolder] : readdirSync(vault, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => join(vault, item.name))
let failures = 0
for (const folder of folders) {
  const notes = join(folder, '01｜單元筆記')
  if (!existsSync(notes)) continue
  for (const name of readdirSync(notes).filter(item => item.endsWith('.md'))) {
    const path = join(notes, name)
    const markdown = readFileSync(path, 'utf8').replace(/\r/g, '')
    const status = markdown.match(/^status:\s*(.+)$/m)?.[1]?.trim()
    if (status !== '內容筆記完成') continue
    const summary = section(markdown, '這一課在教什麼？') || section(markdown, '一句話結論')
    const points = list(section(markdown, '重點整理'))
    const sources = list(section(markdown, '來源時間碼'))
    const problems = []
    if (summary.length < 45 || summary.length > 600 || placeholder.test(summary)) problems.push('摘要不是可讀的內容結論')
    if (points.length < 3 || points.length > 7) problems.push('重點必須有 3～7 條')
    if (points.some(point => point.length < 16 || point.length > 160 || /[…]/.test(point) || placeholder.test(point))) problems.push('重點含截斷字幕或範本字樣')
    if (sources.length < 3 || sources.some(source => !/\d{2}:\d{2}:\d{2}\s*(?:–|—|-)\s*\d{2}:\d{2}:\d{2}/.test(source) || /[…]/.test(source))) problems.push('每項重點需有完整、非截斷的時間碼摘要')
    if (problems.length) { failures += 1; console.log(`✗ ${name}：${problems.join('；')}`) } else console.log(`✓ ${name}`)
  }
}
if (failures) { console.error(`品質檢查未通過：${failures} 則筆記。未通過的筆記不得標為「內容筆記完成」。`); process.exitCode = 1 } else console.log('品質檢查通過。')
