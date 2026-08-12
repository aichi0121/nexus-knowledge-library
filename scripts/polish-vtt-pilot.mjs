import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (!files.length) throw new Error('請提供至少一個 VTT 檔案。')

function polish(text) {
  return text
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/\b認爲\b/g, '認為')
    .replace(/爲/g, '為')
    .replace(/這個是/g, '這是')
    .replace(/最早的雛形/g, '最早雛形')
    .replace(/以最特別的是/g, '最特別的是')
}

function timestamps(value) { return value.match(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm) || [] }
for (const input of files) {
  if (!input.endsWith('.vtt') || input.endsWith('_字幕潤飾版.vtt')) throw new Error(`不是原始 VTT：${input}`)
  const output = input.replace(/\.vtt$/, '_字幕潤飾版.vtt')
  if (existsSync(output)) { console.log(`略過既有潤飾版：${output}`); continue }
  const source = readFileSync(input, 'utf8')
  const result = source.replace(/^(?!WEBVTT$|\d+$|\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->).*$/gm, line => line ? polish(line) : line)
  if (source.split('\n').length !== result.split('\n').length) throw new Error(`結構驗證失敗：${input}`)
  if (JSON.stringify(timestamps(source)) !== JSON.stringify(timestamps(result))) throw new Error(`時間碼驗證失敗：${input}`)
  writeFileSync(output, result, 'utf8')
  console.log(`完成：${output}`)
}
