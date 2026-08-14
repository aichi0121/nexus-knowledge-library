import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const label = 'com.nexus.knowledge-sync'
const agents = join(homedir(), 'Library', 'LaunchAgents')
const plistPath = join(agents, `${label}.plist`)
const logs = join(root, '.logs')
const command = process.argv[2] || 'status'
const uid = process.getuid?.() || 0

const run = args => spawnSync('launchctl', args, { encoding: 'utf8' })
if (command === 'install') {
  mkdirSync(agents, { recursive: true })
  mkdirSync(logs, { recursive: true })
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${process.execPath}</string><string>${join(root, 'scripts/watch-nexus-sync.mjs')}</string></array><key>WorkingDirectory</key><string>${root}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${join(logs, 'sync-service.log')}</string><key>StandardErrorPath</key><string>${join(logs, 'sync-service-error.log')}</string></dict></plist>\n`
  if (existsSync(plistPath)) run(['bootout', `gui/${uid}`, plistPath])
  writeFileSync(plistPath, plist, 'utf8')
  const result = run(['bootstrap', `gui/${uid}`, plistPath])
  if (result.status !== 0) throw new Error(result.stderr || '無法啟動背景服務')
  console.log('Nexus 背景同步服務已啟動。')
} else if (command === 'uninstall') {
  if (existsSync(plistPath)) { run(['bootout', `gui/${uid}`, plistPath]); unlinkSync(plistPath) }
  console.log('Nexus 背景同步服務已移除。')
} else {
  const result = run(['print', `gui/${uid}/${label}`])
  console.log(result.status === 0 ? 'Nexus 背景同步服務：運行中。' : 'Nexus 背景同步服務：未安裝。')
}
