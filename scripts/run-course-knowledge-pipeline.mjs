import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const vault = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const requested = process.argv.includes('--course') ? process.argv[process.argv.indexOf('--course') + 1] : '193｜（墨夏班）AI影片創作0-1實戰營'
const coursePath = resolve(requested.startsWith('/') ? requested : `${vault}/${requested}`)

if (!existsSync(coursePath)) throw new Error(`找不到課程：${coursePath}`)
const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exitCode = result.status || 1
  return result.status === 0
}

console.log(`開始知識化流程：${coursePath}`)
const prepared = run('scripts/prepare-course-for-nexus.mjs', [coursePath])
const drafted = prepared && run('scripts/generate-lesson-note-drafts.mjs', [coursePath])
const valid = drafted && run('scripts/validate-obsidian-notes.mjs', [coursePath])
if (valid) run('scripts/sync-transcripts-to-firestore.mjs', ['--notes-only', '--course', coursePath])
else console.log('尚未通過品質檢查的筆記已保留在 Obsidian，不會發布到網站。')
