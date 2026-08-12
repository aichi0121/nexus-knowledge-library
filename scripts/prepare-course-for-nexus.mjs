import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const vaultCourses = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipSync = args.includes('--no-sync')
const suppliedPath = args.find(arg => !arg.startsWith('--'))

if (!suppliedPath) {
  console.error('請提供課程資料夾，例如：npm run course:prepare -- "課程資料夾路徑"')
  process.exit(1)
}

const courseFolder = resolve(suppliedPath)
if (!courseFolder.startsWith(`${vaultCourses}/`) || !existsSync(courseFolder)) {
  console.error(`找不到課程資料夾，或它不在課程庫內：${courseFolder}`)
  process.exit(1)
}

const title = basename(courseFolder)
const transcriptFolder = join(courseFolder, '02｜清理逐字稿')
const notesFolder = join(courseFolder, '01｜單元筆記')
const overviewPath = join(courseFolder, '00｜課程總覽.md')
const vttFiles = existsSync(transcriptFolder)
  ? readdirSync(transcriptFolder).filter(name => name.endsWith('_字幕潤飾版.vtt'))
  : []
const noteNames = vttFiles.map(name => name.replace(/_字幕潤飾版\.vtt$/, ''))

function create(path, content, label) {
  if (existsSync(path)) return console.log(`保留既有${label}：${basename(path)}`)
  console.log(`建立${label}：${basename(path)}`)
  if (!dryRun) writeFileSync(path, content, 'utf8')
}

if (!existsSync(notesFolder)) {
  console.log('建立單元筆記資料夾。')
  if (!dryRun) mkdirSync(notesFolder, { recursive: true })
}

const category = /AI|人工智慧|ChatGPT|GPT|影片/i.test(title) ? '數位工具｜AI' : '未分類'
create(overviewPath, `---\ndomain: ${category}\nstatus: 處理中\n---\n\n# ${title}\n\n## 課程說明\n\n待補充課程來源、學習目標與適用情境。\n`, '課程總覽')

for (const name of noteNames) {
  const notePath = join(notesFolder, `${name}.md`)
  create(notePath, `---\ncourse: ${title}\nstatus: 待整理\n---\n\n# ${name}\n\n## 這一課在教什麼？\n\n待從已潤飾字幕整理本課重點。\n\n## 實作步驟\n\n- 待從已潤飾字幕整理。\n\n## 工具／應用程式\n\n- 待從已潤飾字幕整理。\n\n## 提示詞\n\n本堂未提供可直接複製的完整提示詞。\n\n## 來源時間碼\n\n- 待從已潤飾字幕補上。\n`, '單元筆記')
}

if (!noteNames.length) console.log('尚未找到「*_字幕潤飾版.vtt」，已建立課程總覽；字幕完成後再執行一次即可建立單元筆記。')

if (!dryRun && !skipSync) {
  console.log('開始同步到 Nexus 網站…')
  execFileSync(process.execPath, ['scripts/sync-transcripts-to-firestore.mjs'], { cwd: projectRoot, stdio: 'inherit' })
}

console.log(dryRun ? '預覽完成，尚未建立或同步任何檔案。' : '課程已準備完成。')
