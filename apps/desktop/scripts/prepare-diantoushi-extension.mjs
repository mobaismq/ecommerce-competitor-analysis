#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const extDir = join(root, 'resources', 'extensions', 'diantoushi')
const OFFICIAL_CRX_URL = 'https://assets.diantoushi.com/plug/%E5%BA%97%E9%80%8F%E8%A7%86-Chrome_5.0.6.crx'
const FALLBACK_VERSION = '5.0.6'
const isForce = process.argv.includes('--force')
const isVerifyOnly = process.argv.includes('--verify-only')
const sourceIndex = process.argv.indexOf('--source')
if (sourceIndex !== -1 && !process.argv[sourceIndex + 1]) throw new Error('--source 需要扩展目录路径')
const sourceDir = sourceIndex === -1 ? null : resolve(process.argv[sourceIndex + 1])

function validate(dir) {
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  if (!/店透视|diantoushi/i.test(m.name || '') || !/^\d+(\.\d+){0,3}$/.test(m.version || '') || m.manifest_version !== 3) {
    throw new Error('扩展名称、版本或 manifest_version 不合法')
  }
  const files = [
    m.background?.service_worker, m.action?.default_popup,
    ...Object.values(m.icons || {}), ...Object.values(m.action?.default_icon || {}),
    ...(m.content_scripts || []).flatMap(s => [...(s.js || []), ...(s.css || [])]),
  ].filter(Boolean)
  for (const file of files) {
    const target = resolve(dir, file)
    const rel = relative(resolve(dir), target)
    if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(target)) throw new Error(`扩展引用文件缺失或路径非法: ${file}`)
  }
  return m
}

function install(source) {
  const parent = join(root, 'resources', 'extensions')
  mkdirSync(parent, { recursive: true })
  const stage = mkdtempSync(join(parent, '.diantoushi-'))
  const backup = `${stage}.backup`
  let backedUp = false
  try {
    cpSync(source, stage, {
      recursive: true,
      filter: path => !['_metadata', '__MACOSX', '.DS_Store', '__pycache__'].includes(basename(path)),
    })
    const m = validate(stage)
    if (existsSync(extDir)) { renameSync(extDir, backup); backedUp = true }
    renameSync(stage, extDir)
    console.log(`[prepare-extension] 已内置 ${m.name} v${m.version}: ${extDir}`)
  } catch (error) {
    if (backedUp) { rmSync(extDir, { recursive: true, force: true }); renameSync(backup, extDir) }
    throw error
  } finally {
    rmSync(stage, { recursive: true, force: true })
    rmSync(backup, { recursive: true, force: true })
  }
}

if (isVerifyOnly) {
  const m = validate(extDir)
  console.log(`[prepare-extension] 文件完整性校验通过: ${m.name} v${m.version}（非签名验证）`)
} else if (sourceDir) {
  validate(sourceDir)
  install(sourceDir)
} else {
  let ready = false
  if (!isForce && existsSync(join(extDir, 'manifest.json'))) {
    try {
      const m = validate(extDir)
      console.log(`[prepare-extension] 保留已内置 ${m.name} v${m.version}: ${extDir}`)
      ready = true
    } catch (error) { console.warn(`[prepare-extension] 本地扩展不可用: ${error.message}`) }
  }
  if (!ready) {
    console.log(`[prepare-extension] 下载官方回退版本 ${FALLBACK_VERSION}: ${OFFICIAL_CRX_URL}`)
    const temp = mkdtempSync(join(tmpdir(), 'dts-extension-'))
    try {
      const response = await fetch(OFFICIAL_CRX_URL, { signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 12 || buffer.toString('utf8', 0, 4) !== 'Cr24' || buffer.readUInt32LE(4) !== 3) throw new Error('不是有效 CRX3 文件')
      const offset = 12 + buffer.readUInt32LE(8)
      if (offset >= buffer.length) throw new Error('CRX3 头部越界')
      const zip = join(temp, 'extension.zip')
      const unpacked = join(temp, 'unpacked')
      writeFileSync(zip, buffer.subarray(offset))
      const pythonBin = process.platform === 'win32' ? join(root, 'resources/python/python.exe') : join(root, 'resources/python/bin/python3')
      execFileSync(existsSync(pythonBin) ? pythonBin : process.platform === 'win32' ? 'python' : 'python3', [
        '-c', 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, unpacked,
      ], { stdio: 'inherit' })
      if (validate(unpacked).version !== FALLBACK_VERSION) throw new Error('下载扩展版本不匹配')
      install(unpacked)
    } finally { rmSync(temp, { recursive: true, force: true }) }
  }
}
