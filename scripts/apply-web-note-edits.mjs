import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const root = resolve(new URL('..', import.meta.url).pathname)
const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const hash = value => createHash('sha1').update(value).digest('hex').slice(0, 16)
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(join(root, '.secrets/firebase-service-account.json'), 'utf8'))) })
const db = getFirestore(app)
const section = (text, heading, body) => { const hit = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(text); if (!hit) return text; const start = hit.index + hit[0].length; const next = /^##\s+/m.exec(text.slice(start)); const end = next ? start + next.index : text.length; return `${text.slice(0, start)}\n\n${body.trim()}\n${text.slice(end)}` }
let count = 0
for (const item of readdirSync(vault, { withFileTypes: true }).filter(item => item.isDirectory())) {
  const folder = join(vault, item.name); const overview = join(folder, '00｜課程總覽.md')
  if (!existsSync(overview)) continue
  const title = readFileSync(overview, 'utf8').match(/^#\s+(.+)$/m)?.[1] || item.name
  const id = title.startsWith('193｜（墨夏班）AI影片創作0-1實戰營') ? 'ai-video-creation-193' : `course-${hash(title)}`
  const edits = await db.collection(`courses/${id}/lessons`).get()
  for (const edit of edits.docs) {
    const lesson = edit.data(); const data = lesson.webEdit
    if (data?.status !== 'pending') continue
    const path = lesson.obsidianPath ? join(folder, lesson.obsidianPath) : ''
    if (!path || !existsSync(path)) continue
    let text = readFileSync(path, 'utf8'); const changes = data.changes || {}
    if (typeof changes.summary === 'string') text = section(text, '這一課在教什麼？', changes.summary)
    if (Array.isArray(changes.tools)) text = section(text, '工具／應用程式', changes.tools.map(value => `- ${value}`).join('\n'))
    if (Array.isArray(changes.steps)) text = section(text, '實作步驟', changes.steps.map((value, index) => `${index + 1}. ${value}`).join('\n'))
    writeFileSync(path, text, 'utf8'); await edit.ref.set({ webEdit: { ...data, status: 'applied', appliedAt: FieldValue.serverTimestamp() } }, { merge: true }); count += 1
  }
}
if (count) execFileSync(process.execPath, ['scripts/sync-transcripts-to-firestore.mjs', '--notes-only'], { cwd: root, stdio: 'inherit' })
console.log(`網站筆記回寫完成：${count} 筆。`)
