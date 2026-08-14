import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

const source = resolve(process.argv[2] || '')
const destination = resolve(process.argv[3] || '')
if (!source || !destination || !existsSync(source)) throw new Error('請提供來源課程資料夾與 Obsidian 課程資料夾。')

function walk(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const files = walk(source).filter(path => /\.(vtt|srt)$/i.test(path))
let copied = 0
for (const path of files) {
  const isPolished = /_字幕潤飾版\.vtt$/i.test(path)
  const group = isPolished ? '01｜潤飾字幕' : '00｜原始字幕'
  const target = join(destination, '02｜清理逐字稿', group, relative(source, dirname(path)), basename(path))
  if (existsSync(target) && statSync(target).size === statSync(path).size) continue
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(path, target)
  copied += 1
}
console.log(`字幕來源入庫完成：原始／潤飾共 ${files.length} 份，新增或更新 ${copied} 份。`)
