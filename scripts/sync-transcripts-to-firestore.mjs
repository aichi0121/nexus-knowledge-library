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
const searchTokens = value => [...new Set(String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).flatMap(token => token.length > 1 ? [token, ...[...token].filter(char => /[\p{Script=Han}]/u.test(char))] : []))].slice(0, 180)
const stripMarkdown = value => value
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, '')
  .trim()

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')
  const start = new RegExp(`^##\\s+${escaped}\\s*$`, 'm').exec(markdown)
  if (!start) return ''
  const bodyStart = start.index + start[0].length
  const remainder = markdown.slice(bodyStart)
  const nextHeading = /^##\s+/m.exec(remainder)
  return (nextHeading ? remainder.slice(0, nextHeading.index) : remainder).trim()
}

function useful(value) {
  const text = stripMarkdown(value).replace(/^[-*\d.\s]+/, '').trim()
  return Boolean(text) && !/^(待|無|沒有|本堂未提供|請從|避免僅)/.test(text)
}

function listFrom(sectionText) {
  return sectionText
    .split('\n')
    .filter(line => /^\s*(?:[-*]|\d+[.)])\s+/.test(line))
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .map(stripMarkdown)
    .filter(useful)
}

function firstSection(markdown, headings) {
  return headings.map(heading => section(markdown, heading)).find(Boolean) || ''
}

function lessonFromNote(path) {
  const markdown = readFileSync(path, 'utf8').replace(/\r/g, '')
  const title = stripMarkdown(markdown.match(/^#\s+(.+)$/m)?.[1] || path.split('/').at(-1).replace(/\.md$/, ''))
  const filename = path.split('/').at(-1).replace(/\.md$/, '')
  const tools = listFrom(firstSection(markdown, ['工具／應用程式', '工具／方法', '工具與方法']))
  const concepts = listFrom(firstSection(markdown, ['關鍵概念', '核心概念', '概念與方法']))
  const steps = listFrom(firstSection(markdown, ['實作步驟', '可立即行動']))
  const keyPoints = listFrom(firstSection(markdown, ['重點整理', '本課重點']))
  const summary = stripMarkdown(section(markdown, '這一課在教什麼？'))
  const prompts = section(markdown, '提示詞')
  const source = section(markdown, '來源時間碼')
  const sourceReferences = source.split('\n').flatMap(line => {
    // Notes use Markdown bold for readable time ranges. Parse the rendered text,
    // otherwise asterisks prevent valid source references from being published.
    const normalized = stripMarkdown(line)
    const match = normalized.match(/(\d{2}:\d{2}:\d{2}\s*(?:–|—|-)\s*\d{2}:\d{2}:\d{2})[`:：\s]+(.+)/)
    if (!match) return []
    const note = stripMarkdown(match[2])
    return useful(note) ? [{ time: match[1].replace(/\s+/g, ''), note }] : []
  })
  const sourceTimeRanges = sourceReferences.map(item => item.time)
  const status = markdown.match(/^status:\s*(.+)$/m)?.[1]?.trim()
  const isPublished = status === '內容筆記完成'
    && useful(summary)
    && keyPoints.length >= 3
    && sourceReferences.length >= 3
    && keyPoints.every(point => point.length >= 16 && point.length <= 160 && !/[…]/.test(point))
  return {
    id: slug(filename),
    title,
    ...(useful(summary) ? { summary } : {}),
    ...(tools.length ? { tools } : {}),
    // Always send arrays so a later, better Obsidian note removes stale
    // transcript-derived data left by an earlier sync.
    concepts,
    ...(keyPoints.length ? { keyPoints } : {}),
    ...(steps.length ? { steps } : {}),
    ...(sourceTimeRanges.length ? { sourceTimeRanges, sourceReferences } : {}),
    ...(useful(prompts) ? { prompts: listFrom(prompts) } : {}),
    ...(status ? { status } : {}),
    isPublished,
    noteQuality: isPublished ? '已完成內容理解' : '待內容理解',
  }
}

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
  const id = title.startsWith('193｜（墨夏班）AI影片創作0-1實戰營') ? 'ai-video-creation-193' : `course-${hash(title)}`
  return { id, title, category }
}

async function syncCourse(db, ownerId, folder, dryRun) {
  const transcriptFolder = join(folder, '02｜清理逐字稿')
  const notesFolder = join(folder, '01｜單元筆記')
  const files = existsSync(transcriptFolder) ? readdirSync(transcriptFolder).filter(name => name.endsWith('_字幕潤飾版.vtt')) : []
  const noteFiles = existsSync(notesFolder) ? readdirSync(notesFolder).filter(name => name.endsWith('.md')) : []
  if (!files.length && !noteFiles.length) return { segments: 0, notes: 0 }
  const course = metadata(folder)
  const notesOnly = process.argv.includes('--notes-only')
  const records = notesOnly ? [] : files.flatMap(file => {
    const name = file.replace(/_字幕潤飾版\.vtt$/, '')
    const lessonId = slug(name)
    return segments(join(transcriptFolder, file)).map((segment, index) => ({ id: `${lessonId}-${String(index + 1).padStart(4, '0')}`, lessonId, sourceCaptionPath: file, tags: [course.category], searchTokens: searchTokens(segment.cleanText), ...segment }))
  })
  const lessons = noteFiles.map(file => ({ ...lessonFromNote(join(notesFolder, file)), obsidianPath: `01｜單元筆記/${file}` }))
  console.log(`${course.title}：${notesOnly ? '略過字幕索引' : `${records.length} 個段落`}、${lessons.length} 則單元筆記`)
  if (dryRun) return { segments: records.length, notes: lessons.length }
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch()
    records.slice(i, i + 400).forEach(record => batch.set(db.doc(`courses/${course.id}/transcriptSegments/${record.id}`), { ...record, ownerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
    await batch.commit()
  }
  for (const lesson of lessons) {
    await db.doc(`courses/${course.id}/lessons/${lesson.id}`).set({ ...lesson, ownerId, syncedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    await db.doc(`searchIndex/${course.id}-${lesson.id}`).set({
      ownerId,
      courseId: course.id,
      lessonId: lesson.id,
      kind: '筆記',
      title: lesson.title,
      category: course.category,
      summary: lesson.summary || '',
      sourceTime: lesson.sourceReferences?.[0]?.time || '',
      searchTokens: searchTokens([lesson.title, lesson.summary, ...(lesson.keyPoints || []), ...(lesson.concepts || []), ...(lesson.tools || []), ...(lesson.steps || [])].join(' ')),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
  const existingLessons = await db.collection(`courses/${course.id}/lessons`).get()
  const desiredByPath = new Map(lessons.map(lesson => [lesson.obsidianPath, lesson.id]))
  const legacyNotes = existingLessons.docs.filter(doc => {
    const desiredId = desiredByPath.get(doc.data().obsidianPath)
    return desiredId && desiredId !== doc.id
  })
  if (legacyNotes.length) {
    const batch = db.batch()
    legacyNotes.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
  }
  const quality = {
    totalNotes: lessons.length,
    verifiedNotes: lessons.filter(lesson => lesson.isPublished).length,
    missingTimecodes: lessons.filter(lesson => useful(lesson.summary) && !lesson.sourceReferences?.length).length,
    pendingReview: lessons.filter(lesson => lesson.status !== '內容筆記完成').length,
    invalidNotes: lessons.filter(lesson => lesson.status === '內容筆記完成' && !lesson.isPublished).length,
  }
  await db.doc(`courses/${course.id}`).set({ ownerId, title: course.title, category: course.category, ...(notesOnly ? {} : { transcriptSegmentCount: records.length, transcriptIndexedAt: FieldValue.serverTimestamp() }), noteCount: lessons.length, quality, notesSyncedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return { segments: records.length, notes: lessons.length }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const requestedCourse = process.argv.includes('--course') ? process.argv[process.argv.indexOf('--course') + 1] : ''
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
  const db = getFirestore(app)
  const users = await db.collection('users').where('email', '==', 'aichi0121@gmail.com').limit(1).get()
  if (users.empty) throw new Error('找不到 Nexus 使用者，請先登入網站一次。')
  const ownerId = users.docs[0].id
  const syncStatus = db.doc('syncStatus/nexus')
  if (!dryRun) await syncStatus.set({ ownerId, status: '同步中', lastStartedAt: FieldValue.serverTimestamp(), pendingSteps: 0, failureReason: '' }, { merge: true })
  const folders = requestedCourse ? [resolve(requestedCourse)] : readdirSync(vaultCourses, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => join(vaultCourses, item.name))
  if (folders.some(folder => !existsSync(folder))) throw new Error(`找不到指定課程：${requestedCourse}`)
  let totalSegments = 0
  let totalNotes = 0
  for (const folder of folders) {
    const result = await syncCourse(db, ownerId, folder, dryRun)
    totalSegments += result.segments
    totalNotes += result.notes
  }
  if (!dryRun) await syncStatus.set({ ownerId, status: '已同步', lastCompletedAt: FieldValue.serverTimestamp(), pendingSteps: 0, failureReason: '', transcriptSegments: totalSegments, lessonNotes: totalNotes }, { merge: true })
  console.log(`${dryRun ? '預覽' : '完成'}：共 ${totalSegments} 個逐字稿段落、${totalNotes} 則單元筆記。`)
}

main().catch(async error => { console.error(`同步失敗：${error.message}`); process.exitCode = 1 })
