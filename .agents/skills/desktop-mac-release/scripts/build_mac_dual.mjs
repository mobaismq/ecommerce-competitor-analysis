import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arch as hostArch, platform } from 'node:process'

if (platform !== 'darwin') {
  console.error('❌ 该脚本仅支持在 macOS 上运行')
  process.exit(1)
}

const repoRoot = resolve(new URL('../../../..', import.meta.url).pathname)
const desktopDir = join(repoRoot, 'apps/desktop')
const pythonDir = join(desktopDir, 'resources/python')
const pythonBin = join(pythonDir, 'bin/python3')
const distDir = join(desktopDir, 'dist')

const args = new Set(process.argv.slice(2))
const archArg = [...args].find((item) => item.startsWith('--arch='))?.split('=')[1] || 'all'
if (!['all', 'arm64', 'x64'].includes(archArg)) {
  console.error('❌ 参数错误：请使用 --arch=all | --arch=arm64 | --arch=x64')
  process.exit(1)
}

const targets = archArg === 'all' ? ['arm64', 'x64'] : [archArg]
const skipRestore = args.has('--no-restore')

function run(cmd, cmdArgs, extraEnv = {}) {
  console.log(`\n▶ ${cmd} ${cmdArgs.join(' ')}`)
  const result = spawnSync(cmd, cmdArgs, {
    cwd: desktopDir,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      UPDATE_URL: process.env.UPDATE_URL || 'https://updates.example.invalid/desktop',
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      ...extraEnv,
    },
  })
  if (result.status !== 0) {
    throw new Error(`命令执行失败 (exit=${result.status}): ${cmd} ${cmdArgs.join(' ')}`)
  }
}

function checkRosetta() {
  if (hostArch !== 'arm64') return
  try {
    execFileSync('arch', ['-x86_64', '/usr/bin/true'], { stdio: 'ignore' })
  } catch {
    throw new Error('本机未安装 Rosetta 2，无法在 Apple Silicon Mac 上为 x64 Python 安装原生依赖。请先执行: softwareupdate --install-rosetta --agree-to-license')
  }
}

function currentPythonArch() {
  if (!existsSync(pythonBin)) return null
  try {
    const out = execFileSync('file', [pythonBin], { encoding: 'utf8' })
    if (out.includes('arm64')) return 'arm64'
    if (out.includes('x86_64')) return 'x64'
  } catch {
    return null
  }
  return null
}

function ensurePythonForArch(targetArch) {
  const existing = currentPythonArch()
  if (existing && existing !== targetArch) {
    console.log(`🧹 清理旧架构 Python (${existing})，准备切换为 ${targetArch}...`)
    rmSync(pythonDir, { recursive: true, force: true })
  }
  mkdirSync(pythonDir, { recursive: true })
  run('node', ['scripts/prepare-python.mjs'], { TARGET_ARCH: targetArch })
}

function generatePrismaForArch(targetArch) {
  const prismaTarget = targetArch === 'arm64' ? 'darwin-arm64' : 'darwin'
  // 清理旧的 engine 文件，避免把错误架构的 dylib 一并打进包里
  const prismaOut = join(desktopDir, 'src/generated/prisma')
  if (existsSync(prismaOut)) {
    for (const file of readdirSync(prismaOut)) {
      if (file.startsWith('libquery_engine-') && file.endsWith('.dylib.node')) {
        rmSync(join(prismaOut, file), { force: true })
      }
    }
  }
  run('pnpm', ['exec', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'], {
    PRISMA_CLI_BINARY_TARGETS: prismaTarget,
  })
}

async function main() {
  if (targets.includes('x64')) checkRosetta()

  console.log('🚀 开始准备 Mac 安装包...')
  run('pnpm', ['build'])
  run('pnpm', ['prepare-extension'])

  for (const targetArch of targets) {
    console.log(`\n==================== 打包 macOS (${targetArch}) ====================`)
    ensurePythonForArch(targetArch)
    generatePrismaForArch(targetArch)
    run('pnpm', [
      'exec',
      'electron-builder',
      '--config',
      'electron-builder.yml',
      '--mac',
      `--${targetArch}`,
      '--publish',
      'never',
    ])
  }

  if (!skipRestore && targets[targets.length - 1] !== hostArch) {
    console.log(`\n🔄 恢复本机开发架构 (${hostArch}) 的 Python 与 Prisma 引擎...`)
    ensurePythonForArch(hostArch)
    generatePrismaForArch(hostArch)
  }

  console.log('\n✅ 打包完成！产物位于 apps/desktop/dist/：')
  if (existsSync(distDir)) {
    const dmgs = readdirSync(distDir)
      .filter((name) => name.endsWith('.dmg'))
      .sort()
    for (const dmg of dmgs) {
      const sizeMb = (statSync(join(distDir, dmg)).size / 1024 / 1024).toFixed(1)
      const label = dmg.includes('arm64') ? 'M 系列芯片 (Apple Silicon)' : 'Intel 芯片 (x64)'
      console.log(`  📦 [${label}] apps/desktop/dist/${dmg} (${sizeMb} MB)`)
    }
  }
  console.log('\n💡 提示：只发上面的 .dmg 单文件给用户，不要发 mac-arm64/ 或 mac/ 目录。')
}

main().catch((err) => {
  console.error(`\n❌ 打包失败: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})

