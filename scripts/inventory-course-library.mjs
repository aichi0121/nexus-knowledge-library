import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const vaultCourses = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const pendingCourses = '/Users/zhengweizhi/Documents/Nexus 待處理課程'
const keyPath = resolve(projectRoot, '.secrets/firebase-service-account.json')
const hash = value => createHash('sha1').update(value).digest('hex').slice(0, 16)
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

function walk(folder) {
  if (!existsSync(folder)) return []
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function classify(title) {
  if (/八字|命理|流年|五行|命盤/.test(title)) return { category: '命理｜人生規劃', tags: ['八字', '五行', '人生規劃'] }
  if (/AI|人工智慧|ChatGPT|GPT|影片/.test(title)) return { category: '數位工具｜AI', tags: ['AI', '內容創作'] }
  return { category: '待分類', tags: [] }
}

function inventory(folder, location) {
  const title = folder.split('/').at(-1)
  const files = walk(folder)
  const rawCaptions = files.filter(path => /\.(vtt|srt)$/i.test(path) && !path.endsWith('_字幕潤飾版.vtt'))
  const polishedCaptions = files.filter(path => path.endsWith('_字幕潤飾版.vtt'))
  const notes = files.filter(path => path.includes('/01｜單元筆記/') && path.endsWith('.md'))
  const pdfs = files.filter(path => path.endsWith('.pdf'))
  const videos = files.filter(path => /\.(mp4|mov|mkv|webm)$/i.test(path))
  const overview = join(folder, '00｜課程總覽.md')
  const overviewText = existsSync(overview) ? readFileSync(overview, 'utf8') : ''
  const titleFromOverview = overviewText.match(/^#\s+(.+)$/m)?.[1]
  const { category, tags } = classify(titleFromOverview || title)
  const id = (titleFromOverview || title).startsWith('193｜（墨夏班）AI影片創作0-1實戰營') ? 'ai-video-creation-193' : `course-${hash(title)}`
  const state = notes.length ? '有筆記' : polishedCaptions.length ? '字幕已整理' : rawCaptions.length ? '待整理' : '無字幕'
  return { id, title: titleFromOverview || title, category, tags, sourceLocation: location, sourcePath: folder, inventoryState: state, rawCaptionCount: rawCaptions.length, processedCaptionCount: polishedCaptions.length, noteCount: notes.length, pdfCount: pdfs.length, videoCount: videos.length, lessonCount: Math.max(rawCaptions.length, polishedCaptions.length) }
}

const folders = [
  ...[vaultCourses, pendingCourses].flatMap(root => existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => ({ folder: join(root, entry.name), location: root === vaultCourses ? '已入庫' : '待處理' })) : []),
]
const uniqueMap = new Map()
for (const item of folders) {
  const name = item.folder.split('/').at(-1)
  if (!uniqueMap.has(name)) uniqueMap.set(name, item)
}
const unique = [...uniqueMap.values()]
const records = unique.map(item => inventory(item.folder, item.location))
console.log(records.map(record => `${record.title}｜${record.category}｜${record.inventoryState}｜原始字幕 ${record.rawCaptionCount}｜已整理字幕 ${record.processedCaptionCount}｜筆記 ${record.noteCount}`).join('\n'))
if (dryRun) { console.log(`預覽：${records.length} 門課。`); process.exit(0) }

const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore(app)
const users = await db.collection('users').where('email', '==', 'aichi0121@gmail.com').limit(1).get()
if (users.empty) throw new Error('找不到 Nexus 使用者，請先登入網站一次。')
const ownerId = users.docs[0].id
for (const record of records) {
  await db.doc(`courses/${record.id}`).set({ ...record, ownerId, inventoryUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
}
console.log(`完成：${records.length} 門課已同步課程庫盤點。`)
