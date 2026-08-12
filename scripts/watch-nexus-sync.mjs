import { watch } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const syncScript = resolve(projectRoot, 'scripts/sync-transcripts-to-firestore.mjs')
let timer
let running = false

function sync() {
  if (running) return
  running = true
  const child = spawn(process.execPath, [syncScript], { cwd: projectRoot, stdio: 'inherit' })
  child.on('exit', () => { running = false })
}

watch(vault, { recursive: true }, (_, changed) => {
  if (!changed?.endsWith('_字幕潤飾版.vtt')) return
  clearTimeout(timer)
  timer = setTimeout(sync, 2500)
})

console.log('Nexus 自動同步已啟動，等待字幕潤飾版變更。')
sync()
