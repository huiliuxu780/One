#!/usr/bin/env node
// 构建产物体积阈值检查：pnpm build 后执行 pnpm size:check。
// 可用 APBOA_SIZE_LIMITS 覆盖阈值（JSON，单位字节），如 {"entry":409600,"page":614400}。
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KB = 1024
const DEFAULT_LIMITS = {
  entry: 400 * KB,
  vendor: 500 * KB,
  xyflow: 1500 * KB,
  codemirror: 900 * KB,
  // Mermaid 自带多种图定义，必须异步加载；此预算不适用于普通页面或首屏。
  mermaid: 700 * KB,
  page: 600 * KB,
  css: 300 * KB,
}

const limits = { ...DEFAULT_LIMITS, ...parseLimits(process.env.APBOA_SIZE_LIMITS) }
const distAssets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/assets')

function parseLimits(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    console.error('APBOA_SIZE_LIMITS 不是合法 JSON，已忽略')
    return {}
  }
}

async function classify(filename) {
  if (filename.endsWith('.css')) return 'css'
  if (!filename.endsWith('.js')) return null
  if (filename.startsWith('index-')) return 'entry'
  if (filename.startsWith('react-')) return 'vendor'
  if (filename.startsWith('xyflow-')) return 'xyflow'
  if (filename.startsWith('codemirror-')) return 'codemirror'
  if (filename.startsWith('mermaid-')) return 'mermaid'
  // Mermaid 的动态图定义由 Vite 自动拆成 hash chunk；按内容识别，避免放宽普通页面预算。
  if (filename.startsWith('chunk-')) {
    const content = await readFile(path.join(distAssets, filename), 'utf8')
    if (content.includes('mermaid')) return 'mermaid'
  }
  return 'page'
}

let failures = 0
const rows = []
for (const entry of await readdir(distAssets)) {
  const kind = await classify(entry)
  if (!kind) continue
  const { size } = await stat(path.join(distAssets, entry))
  const limit = limits[kind]
  const exceeded = size > limit
  if (exceeded) failures += 1
  rows.push({ file: entry, kind, size, limit, exceeded })
}

if (rows.length === 0) {
  console.error(`未在 ${distAssets} 找到构建产物，请先执行 pnpm build`)
  process.exit(1)
}

const format = (bytes) => `${(bytes / KB).toFixed(1)} KB`
for (const row of rows) {
  const mark = row.exceeded ? '✗' : '✓'
  console.log(`${mark} ${row.kind.padEnd(7)} ${format(row.size).padStart(10)} / ${format(row.limit)}  ${row.file}`)
}

if (failures > 0) {
  console.error(`\n${failures} 个产物超出体积阈值；如需调整请修改 scripts/check-bundle-size.mjs 或设置 APBOA_SIZE_LIMITS。`)
  process.exit(1)
}
console.log('\n所有产物均在体积阈值内。')
