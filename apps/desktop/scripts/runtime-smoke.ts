import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arch, platform } from 'node:process'
import { execFileSync } from 'node:child_process'

/**
 * 运行时解包冒烟：读 resources/python/platforms.json 锁版清单，
 * 解析当前平台/架构的 python 可执行文件，断言其存在、可执行且能运行 `--version`。
 * 兼容开发目录（resources/python）与打包后（process.resourcesPath/python）两种位置。
 */
function resolvePythonDir(): string {
  const resourcesOverride = process.env.ECA_PYTHON_DIR
  if (resourcesOverride) return resourcesOverride
  // 打包后：resources/python；开发：apps/desktop/resources/python
  if (process.resourcesPath && existsSync(join(process.resourcesPath, 'python'))) {
    return join(process.resourcesPath, 'python')
  }
  return resolve(import.meta.dirname, '../resources/python')
}

function main() {
  const pythonDir = resolvePythonDir()
  const manifestPath = join(pythonDir, 'platforms.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`platforms.json 缺失: ${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const asset = manifest.assets?.[platform]?.[arch]
  if (!asset) {
    throw new Error(`platforms.json 未覆盖当前目标 ${platform}/${arch}`)
  }
  const pythonBin = platform === 'win32' ? join(pythonDir, 'python.exe') : join(pythonDir, 'bin/python3')
  if (!existsSync(pythonBin)) {
    throw new Error(`内置 Python 二进制缺失: ${pythonBin}（清单声明 ${asset}，version=${manifest.version}）`)
  }
  accessSync(pythonBin, constants.X_OK) // 可执行位
  const out = execFileSync(pythonBin, ['--version'], { encoding: 'utf8' }).trim()
  if (!out.startsWith('Python')) {
    throw new Error(`python --version 输出异常: ${out}`)
  }
  console.log(`✅ runtime-smoke 通过: ${platform}/${arch} ${out} @ ${pythonBin}`)
  console.log(`   版本锁清单 version=${manifest.version} tag=${manifest.releaseTag} asset=${asset}`)
}

main()
