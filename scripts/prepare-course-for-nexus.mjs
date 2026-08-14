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
  create(notePath, `---\ntype: lesson-note\ncourse: ${title}\nsource_caption: ${name}_字幕潤飾版.vtt\nstatus: 待內容理解\nnote_quality: pending\n---\n\n# ${name}\n\n## 一句話結論\n\n> 先完整閱讀字幕後，以自己的話寫出講者真正要你理解或做到的事；不要貼逐字稿。\n\n## 重點整理\n\n- 重點 1：結論或判讀原則（20～120 字）。\n- 重點 2：適用條件、例外或前提。\n- 重點 3：可採取的理解／操作方式。\n\n## 適用條件／限制\n\n- 說明這一課的結論在什麼條件下成立；若是健康、財務或命理內容，標示為講者觀點並保留專業判斷界線。\n\n## 概念與方法\n\n- 概念：用自己的話定義課內真正重要的術語。\n- 方法：列出講者實際教的判讀或操作順序；沒有就寫「本課沒有獨立操作方法」。\n\n## 工具／應用程式\n\n- 只列實際使用的軟體、網站、表格或教具；概念詞不能放在這裡。\n\n## 可立即行動\n\n1. 把課內方法轉成可驗證的下一步。\n\n## 來源時間碼\n\n- \`00:00:00–00:00:00\`：用一句完整摘要說明這段為何是重點；不要貼字幕原文。\n`, '單元筆記')
}

if (!noteNames.length) console.log('尚未找到「*_字幕潤飾版.vtt」，已建立課程總覽；字幕完成後再執行一次即可建立單元筆記。')

if (!dryRun && !skipSync) {
  console.log('筆記範本已建立。完成內容理解與品質檢查後，才會同步到 Nexus 網站。')
}

console.log(dryRun ? '預覽完成，尚未建立或同步任何檔案。' : '課程已準備完成。')
