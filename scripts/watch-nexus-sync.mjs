import { watch } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const syncScript = resolve(projectRoot, 'scripts/sync-transcripts-to-firestore.mjs')
const applyWebEdits = resolve(projectRoot, 'scripts/apply-web-note-edits.mjs')
let timer
let running = false
let transcriptChanged = false

function sync() {
  if (running) return
  running = true
  const syncArgs = transcriptChanged ? [syncScript] : [syncScript, '--notes-only']
  transcriptChanged = false
  const syncChild = spawn(process.execPath, syncArgs, { cwd: projectRoot, stdio: 'inherit' })
  syncChild.on('exit', () => { running = false })
}

function syncWebEdits() {
  if (running) return
  running = true
  const child = spawn(process.execPath, [applyWebEdits], { cwd: projectRoot, stdio: 'inherit' })
  child.on('exit', () => { running = false })
}

watch(vault, { recursive: true }, (_, changed) => {
  const isTranscript = changed?.endsWith('_字幕潤飾版.vtt')
  const isLessonNote = changed?.includes('01｜單元筆記') && changed.endsWith('.md')
  const isCourseOverview = changed?.endsWith('00｜課程總覽.md')
  if (!isTranscript && !isLessonNote && !isCourseOverview) return
  transcriptChanged ||= isTranscript
  clearTimeout(timer)
  timer = setTimeout(sync, 2500)
})

console.log('Nexus 自動同步已啟動，等待字幕潤飾版或單元筆記變更。')
setInterval(syncWebEdits, 30000)
