import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const defaultKeyPath = resolve(projectRoot, '.secrets/firebase-service-account.json')
const defaultTranscriptFolder = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫/193｜（墨夏班）AI影片創作0-1實戰營/02｜清理逐字稿'
const courseId = 'ai-video-creation-193'

const lessonFiles = [
  { lessonId: 'opening', file: '4-0 開營儀式（26-6-11 直播）_字幕潤飾版.vtt', tags: ['開營', '學習流程', 'AI 影片'] },
  { lessonId: 'interactive-video', file: '4-1-6 20分鐘學會AI互動視頻，讓你的內容自動獲客（26-6-17 直播）_字幕潤飾版.vtt', tags: ['AI 互動影片', '內容創作'] },
  { lessonId: 'seedance', file: '4-4-4 升級！Seedance2.5 商業化項目拆解（26-7-31 直播）_字幕潤飾版.vtt', tags: ['Seedance', '商業化', 'AI 影片'] },
]

function parseArgs(args) {
  const valueAfter = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
  return { dryRun: args.includes('--dry-run'), keyPath: valueAfter('--key', defaultKeyPath), transcriptFolder: valueAfter('--transcripts', defaultTranscriptFolder) }
}

function parseTime(value) {
  const [hours, minutes, seconds] = value.replace(',', '.').split(':')
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

function parseVtt(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r/g, '').split('\n')
  const cues = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[.,]\d{3})/)
    if (!match) continue
    const content = []
    while (++index < lines.length && lines[index].trim()) content.push(lines[index].trim())
    if (content.length) cues.push({ start: match[1], end: match[2], text: content.join(' ') })
  }
  return cues
}

function groupCues(cues, size = 12) {
  const groups = []
  for (let index = 0; index < cues.length; index += size) {
    const group = cues.slice(index, index + size)
    groups.push({ startTime: group[0].start, endTime: group.at(-1).end, startSeconds: parseTime(group[0].start), endSeconds: parseTime(group.at(-1).end), cleanText: group.map(item => item.text).join(' ') })
  }
  return groups
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const serviceAccount = JSON.parse(readFileSync(options.keyPath, 'utf8'))
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore(app)
  const users = await db.collection('users').where('email', '==', 'aichi0121@gmail.com').limit(1).get()
  if (users.empty) throw new Error('找不到已登入的 Nexus 使用者；請先登入網站一次。')
  const ownerId = users.docs[0].id
  const segments = lessonFiles.flatMap(({ lessonId, file, tags }) => groupCues(parseVtt(resolve(options.transcriptFolder, file))).map((segment, index) => ({ id: `${lessonId}-${String(index + 1).padStart(4, '0')}`, lessonId, tags, sourceCaptionPath: basename(file), ...segment })))

  console.log(`準備同步 ${segments.length} 個逐字稿段落（僅清理版 VTT）。`)
  if (options.dryRun) return
  for (let index = 0; index < segments.length; index += 400) {
    const batch = db.batch()
    for (const segment of segments.slice(index, index + 400)) {
      batch.set(db.doc(`courses/${courseId}/transcriptSegments/${segment.id}`), { ...segment, ownerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  await db.doc(`courses/${courseId}`).set({ transcriptSegmentCount: segments.length, transcriptIndexedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  console.log(`已同步 ${segments.length} 個段落至 Firestore。`)
}

main().catch(error => { console.error(`同步失敗：${error.message}`); process.exitCode = 1 })
