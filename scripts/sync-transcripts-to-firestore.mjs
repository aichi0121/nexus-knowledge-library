import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const root = resolve(new URL('..', import.meta.url).pathname)
const vaultCourses = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const keyPath = resolve(root, '.secrets/firebase-service-account.json')
const knownLessons = new Map([
  ['4-0 開營儀式（26-6-11 直播）', 'opening'],
  ['4-1-6 20分鐘學會AI互動視頻，讓你的內容自動獲客（26-6-17 直播）', 'interactive-video'],
  ['4-4-4 升級！Seedance2.5 商業化項目拆解（26-7-31 直播）', 'seedance'],
])

const hash = value => createHash('sha1').update(value).digest('hex').slice(0, 16)
const timeToSeconds = value => { const [h, m, s] = value.replace(',', '.').split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(s) }
const slug = value => knownLessons.get(value) || `lesson-${hash(value)}`

function cues(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').split('\n')
  const result = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[.,]\d{3})/)
    if (!match) continue
    const text = []
    while (++i < lines.length && lines[i].trim()) text.push(lines[i].trim())
    if (text.length) result.push({ start: match[1], end: match[2], text: text.join(' ') })
  }
  return result
}

function segments(path) {
  const source = cues(path)
  const result = []
  for (let i = 0; i < source.length; i += 12) {
    const group = source.slice(i, i + 12)
    result.push({ startTime: group[0].start, endTime: group.at(-1).end, startSeconds: timeToSeconds(group[0].start), endSeconds: timeToSeconds(group.at(-1).end), cleanText: group.map(item => item.text).join(' ') })
  }
  return result
}

function metadata(folder) {
  const overview = join(folder, '00｜課程總覽.md')
  const text = existsSync(overview) ? readFileSync(overview, 'utf8') : ''
  const title = text.match(/^#\s+(.+)$/m)?.[1] || folder.split('/').at(-1)
  const category = text.match(/^domain:\s*(.+)$/m)?.[1] || '未分類'
  const id = title.startsWith('193｜（墨夏班）AI影片創作0-1實戰營') ? 'ai-video-creation-193' : `course-${hash(folder)}`
  return { id, title, category }
}

async function syncCourse(db, ownerId, folder, dryRun) {
  const transcriptFolder = join(folder, '02｜清理逐字稿')
  if (!existsSync(transcriptFolder)) return 0
  const files = readdirSync(transcriptFolder).filter(name => name.endsWith('_字幕潤飾版.vtt'))
  if (!files.length) return 0
  const course = metadata(folder)
  const records = files.flatMap(file => {
    const name = file.replace(/_字幕潤飾版\.vtt$/, '')
    const lessonId = slug(name)
    return segments(join(transcriptFolder, file)).map((segment, index) => ({ id: `${lessonId}-${String(index + 1).padStart(4, '0')}`, lessonId, sourceCaptionPath: file, tags: [course.category], ...segment }))
  })
  console.log(`${course.title}：${records.length} 個段落`)
  if (dryRun) return records.length
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch()
    records.slice(i, i + 400).forEach(record => batch.set(db.doc(`courses/${course.id}/transcriptSegments/${record.id}`), { ...record, ownerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
    await batch.commit()
  }
  await db.doc(`courses/${course.id}`).set({ ownerId, title: course.title, category: course.category, transcriptSegmentCount: records.length, transcriptIndexedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return records.length
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
  const db = getFirestore(app)
  const users = await db.collection('users').where('email', '==', 'aichi0121@gmail.com').limit(1).get()
  if (users.empty) throw new Error('找不到 Nexus 使用者，請先登入網站一次。')
  const folders = readdirSync(vaultCourses, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => join(vaultCourses, item.name))
  let total = 0
  for (const folder of folders) total += await syncCourse(db, users.docs[0].id, folder, dryRun)
  console.log(`${dryRun ? '預覽' : '完成'}：共 ${total} 個逐字稿段落。`)
}

main().catch(error => { console.error(`同步失敗：${error.message}`); process.exitCode = 1 })
