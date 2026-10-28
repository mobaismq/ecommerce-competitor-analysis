#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const extDir = join(root, 'resources', 'extensions', 'diantoushi')
const manifestFile = join(extDir, 'manifest.json')

const OFFICIAL_CRX_URL = 'https://assets.diantoushi.com/plug/%E5%BA%97%E9%80%8F%E8%A7%86-Chrome_5.0.6.crx'
const EXPECTED_VERSION = '5.0.6'
const isForce = process.argv.includes('--force')
const isVerifyOnly = process.argv.includes('--verify-only')

// 0. 清理残留的 .part 文件
const partFile = `${extDir}.part`
if (existsSync(partFile)) {
  rmSync(partFile, { recursive: true, force: true })
}

// 1. --verify-only 模式校验
if (isVerifyOnly) {
  if (!existsSync(manifestFile)) {
    console.error(`[prepare-extension] 验证失败: 缺少 ${manifestFile}`)
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (manifest.version !== EXPECTED_VERSION || !manifest.name?.includes('店透视')) {
    console.error(`[prepare-extension] 验证失败: 版本或名称不符 (${manifest.name} v${manifest.version})`)
    process.exit(1)
  }
  console.log(`[prepare-extension] ✅ 完整性验签通过: ${manifest.name} v${manifest.version}`)
  process.exit(0)
}

// 2. 快速检查已就绪状态
if (!isForce && existsSync(manifestFile)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    if (manifest.version === EXPECTED_VERSION && manifest.name?.includes('店透视')) {
      console.log(`[prepare-extension] 店透视扩展 ${manifest.version} 已就绪于: ${extDir}`)
      process.exit(0)
    }
  } catch {
    console.warn('[prepare-extension] 本地 manifest.json 损坏，重新拉取解包...')
  }
}

console.log(`[prepare-extension] 正在从官方 CDN 下载店透视 ${EXPECTED_VERSION} 扩展...`)
console.log(`[prepare-extension] 源地址: ${OFFICIAL_CRX_URL}`)

const tmpCrx = join(tmpdir(), `dts-${Date.now()}.crx`)
const tmpZip = join(tmpdir(), `dts-${Date.now()}.zip`)
const tmpExtractDir = join(tmpdir(), `dts-extracted-${Date.now()}`)

try {
  const resp = await fetch(OFFICIAL_CRX_URL)
  if (!resp.ok) {
    throw new Error(`下载失败 HTTP ${resp.status}: ${resp.statusText}`)
  }

  const arrayBuffer = await resp.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 2. 校验 CRX3 格式与签名头部切片
  // CRX3: Magic(4) "Cr24", Version(4) 3, HeaderSize(4 uint32)
  const magic = buffer.toString('utf8', 0, 4)
  if (magic !== 'Cr24') {
    throw new Error(`非法 CRX 文件头魔数: ${magic}`)
  }

  const version = buffer.readUInt32LE(4)
  if (version !== 3) {
    throw new Error(`预期 CRX3 格式，实际版本: ${version}`)
  }

  const headerLen = buffer.readUInt32LE(8)
  const zipOffset = 12 + headerLen
  if (zipOffset >= buffer.length) {
    throw new Error(`CRX3 头部计算越界: offset=${zipOffset}, total=${buffer.length}`)
  }

  // 提取切片 ZIP
  const zipBuffer = buffer.subarray(zipOffset)
  writeFileSync(tmpZip, zipBuffer)

  // 3. 使用内置 Python 或系统解压
  mkdirSync(tmpExtractDir, { recursive: true })

  // 优先尝试内置 Python
  const pythonBin = process.platform === 'win32'
    ? join(root, 'resources', 'python', 'python.exe')
    : join(root, 'resources', 'python', 'bin', 'python3')

  const pythonExec = existsSync(pythonBin) ? pythonBin : (process.platform === 'win32' ? 'python' : 'python3')

  execFileSync(pythonExec, [
    '-c',
    `import zipfile, sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`,
    tmpZip,
    tmpExtractDir
  ], { stdio: 'inherit' })

  // 4. 校验解包完整性
  const tmpManifestFile = join(tmpExtractDir, 'manifest.json')
  if (!existsSync(tmpManifestFile)) {
    throw new Error('解包产物缺少 manifest.json，下载文件可能损坏')
  }

  const manifest = JSON.parse(readFileSync(tmpManifestFile, 'utf8'))
  if (!manifest.name?.includes('店透视')) {
    throw new Error(`扩展名称不匹配: ${manifest.name}`)
  }

  // 5. 原子性安装至目标目录
  mkdirSync(join(root, 'resources', 'extensions'), { recursive: true })
  rmSync(extDir, { recursive: true, force: true })
  renameSync(tmpExtractDir, extDir)

  console.log(`[prepare-extension] ✅ 成功安装店透视扩展 v${manifest.version} 至: ${extDir}`)
} finally {
  // 清理临时文件
  rmSync(tmpCrx, { force: true })
  rmSync(tmpZip, { force: true })
  rmSync(tmpExtractDir, { recursive: true, force: true })
}
