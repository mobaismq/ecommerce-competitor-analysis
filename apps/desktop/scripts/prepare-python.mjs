import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { arch, platform } from 'node:process'

const root = resolve(new URL('..', import.meta.url).pathname)
const pythonDir = join(root, 'resources/python')
const version = '3.12.14'
const tag = '20260901'
const baseUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${tag}`

const assets = {
  darwin: {
    arm64: `cpython-${version}+${tag}-aarch64-apple-darwin-install_only_stripped.tar.gz`,
    x64: `cpython-${version}+${tag}-x86_64-apple-darwin-install_only_stripped.tar.gz`,
  },
  win32: {
    x64: `cpython-${version}+${tag}-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`,
  },
}

const asset = assets[platform]?.[arch]
if (!asset) {
  throw new Error(`unsupported Python runtime target: ${platform}/${arch}`)
}

mkdirSync(pythonDir, { recursive: true })

const pythonExecutable = platform === 'win32' ? join(pythonDir, 'python.exe') : join(pythonDir, 'bin/python3')
if (!existsSync(pythonExecutable)) {
  const url = `${baseUrl}/${asset}`
  const archive = join(tmpdir(), asset)
  console.log(`downloading embedded Python ${version}: ${url}`)

  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`failed to download Python runtime: ${response.status} ${response.statusText}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))

  rmSync(pythonDir, { recursive: true, force: true })
  mkdirSync(pythonDir, { recursive: true })
  execFileSync('tar', ['-xzf', archive, '-C', pythonDir, '--strip-components=1'], { stdio: 'inherit' })
  rmSync(archive, { force: true })
}

if (platform !== 'win32') {
  execFileSync('chmod', ['+x', pythonExecutable], { stdio: 'inherit' })
}

execFileSync(pythonExecutable, ['-m', 'pip', 'install', '--no-cache-dir', '-r', join(root, 'requirements.txt')], {
  stdio: 'inherit',
})

console.log(`Python runtime ready: ${version}+${tag} ${platform}/${arch}`)
