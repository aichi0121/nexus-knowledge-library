import { existsSync, lstatSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const vaultCourses = '/Users/zhengweizhi/Documents/Nexus Obsidian Vault/02-課程庫'
const source = process.argv[2] ? resolve(process.argv[2]) : ''
if (!source || !existsSync(source)) throw new Error('請提供待處理課程資料夾。')

const target = join(vaultCourses, basename(source))
if (!existsSync(target)) throw new Error(`尚未建立課程入庫骨架：${target}`)
const captions = join(target, '02｜清理逐字稿')
const materials = join(target, '03｜講義與附件')
mkdirSync(captions, { recursive: true })
mkdirSync(materials, { recursive: true })

const link = (from, to) => {
  if (existsSync(to)) return '保留'
  symlinkSync(from, to)
  return '建立'
}

let captionLinks = 0
let materialLinks = 0
const missingPolished = []
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  const path = join(source, entry.name)
  if (entry.name.endsWith('_字幕潤飾版.vtt')) {
    if (link(path, join(captions, entry.name)) === '建立') captionLinks += 1
  } else if (entry.name.endsWith('.vtt')) {
    const polished = path.replace(/\.vtt$/, '_字幕潤飾版.vtt')
    if (!existsSync(polished)) missingPolished.push(entry.name)
  } else if (/\.(?:pdf|docx?|xlsx?|pptx?)$/i.test(entry.name)) {
    if (link(path, join(materials, entry.name)) === '建立') materialLinks += 1
  }
}
if (missingPolished.length) throw new Error(`尚有 ${missingPolished.length} 份原始字幕未產生潤飾版：${missingPolished.join('、')}`)
console.log(`完成資產入庫：新增字幕連結 ${captionLinks}、講義連結 ${materialLinks}。`)
