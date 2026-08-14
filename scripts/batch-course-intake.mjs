import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const defaultSources = ['/Users/zhengweizhi/Documents/Nexus 待處理課程', '/Users/zhengweizhi/Documents/Nexus 待入庫課程']
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const sourceRoots = args.filter(value => !value.startsWith('--')).map(value => resolve(value))
const roots = sourceRoots.length ? sourceRoots : defaultSources.filter(existsSync)

const classify = title => {
  if (/八字|命理|流年|五行|命盤/.test(title)) return '命理｜人生規劃'
  if (/AI|人工智慧|ChatGPT|GPT|影片/.test(title)) return '數位工具｜AI'
  return '待分類'
}

const candidates = roots.flatMap(root => existsSync(root) ? readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => ({ title: entry.name, sourcePath: join(root, entry.name), targetPath: join(vault, entry.name), category: classify(entry.name) })) : [])

if (!candidates.length) {
  console.log('找不到可入庫課程資料夾。可將課程資料夾放進「Nexus 待處理課程」或以路徑指定來源。')
  process.exit(0)
}

for (const course of candidates) {
  const exists = existsSync(course.targetPath)
  console.log(`${exists ? '已入庫' : apply ? '建立入庫骨架' : '待建立'}｜${course.title}｜${course.category}`)
  if (!apply || exists) continue
  mkdirSync(course.targetPath, { recursive: true })
  const overview = join(course.targetPath, '00｜課程總覽.md')
  if (!existsSync(overview)) writeFileSync(overview, `---\ndomain: ${course.category}\nstatus: 待處理\nsource_path: ${course.sourcePath}\n---\n\n# ${course.title}\n\n## 課程說明\n\n等待字幕、講義或人工補充後進入知識化流程。\n`, 'utf8')
  mkdirSync(join(course.targetPath, '01｜單元筆記'), { recursive: true })
  mkdirSync(join(course.targetPath, '02｜清理逐字稿', '00｜原始字幕'), { recursive: true })
  mkdirSync(join(course.targetPath, '02｜清理逐字稿', '01｜潤飾字幕'), { recursive: true })
}

console.log(`${apply ? '完成建立' : '預覽完成'}：${candidates.length} 門課。原始影音維持在來源資料夾，不會搬移或複製。`)
