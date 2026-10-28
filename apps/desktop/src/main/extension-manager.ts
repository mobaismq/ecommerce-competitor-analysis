import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface ExtensionValidationResult {
  valid: boolean
  name?: string
  version?: string
  manifestVersion?: number
  error?: string
}

/** 校验扩展目录结构与 manifest.json 完整性 */
export function validateExtensionDir(dir: string): ExtensionValidationResult {
  if (!dir || !existsSync(dir)) {
    return { valid: false, error: '扩展目录不存在' }
  }
  const manifestPath = join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    return { valid: false, error: '缺少 manifest.json 文件' }
  }
  try {
    const raw = readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)
    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, error: 'manifest.json 不是合法的 JSON 对象' }
    }
    if (!manifest.name || typeof manifest.name !== 'string' || !manifest.name.includes('店透视')) {
      return { valid: false, error: `扩展名称不匹配: ${manifest.name}` }
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      return { valid: false, error: 'manifest.json 缺少有效的 version 字段' }
    }
    return {
      valid: true,
      name: manifest.name,
      version: manifest.version,
      manifestVersion: manifest.manifest_version,
    }
  } catch (err) {
    return { valid: false, error: `解析 manifest.json 失败: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** 解析出厂打包内置的店透视扩展路径 */
export function getBundledExtensionPath(): string {
  const isPackaged = app?.isPackaged ?? false
  if (isPackaged && process.resourcesPath) {
    return join(process.resourcesPath, 'extensions', 'diantoushi')
  }
  const desktopRoot = resolve(__dirname, '..', '..')
  return join(desktopRoot, 'resources', 'extensions', 'diantoushi')
}

/** 解析系统用户数据目录中的店透视扩展路径 (支持运行时自愈与热更新) */
export function getUserDataExtensionPath(): string {
  try {
    const userData = app.getPath('userData')
    return join(userData, 'extensions', 'diantoushi')
  } catch {
    // 单元测试或无 Electron app 容器环境回退
    return join(process.cwd(), '.test-user-data', 'extensions', 'diantoushi')
  }
}

/**
 * 获取当前生效的店透视扩展路径（双级自愈保底）：
 * 1. 优先使用用户数据目录中的热更新版本；
 * 2. 若用户目录缺失或损坏，自动从安装包出厂内置目录拷贝恢复；
 * 3. 最终返回合法的扩展目录路径；若均不可用抛出明确异常。
 */
export function resolveActiveExtensionPath(): string {
  const userPath = getUserDataExtensionPath()
  const userValid = validateExtensionDir(userPath)
  if (userValid.valid) {
    return userPath
  }

  // 出厂兜底恢复
  const bundledPath = getBundledExtensionPath()
  const bundledValid = validateExtensionDir(bundledPath)
  if (bundledValid.valid) {
    try {
      mkdirSync(join(userPath, '..'), { recursive: true })
      rmSync(userPath, { recursive: true, force: true })
      cpSync(bundledPath, userPath, { recursive: true })
      return userPath
    } catch {
      // 拷贝失败直接退守出厂内置路径
      return bundledPath
    }
  }

  throw new Error(`未找到可用的店透视扩展资产 (用户目录: ${userPath}, 出厂目录: ${bundledPath})`)
}

/** 原子替换扩展目录，支持旧版本备份与损坏回滚 */
export function atomicReplaceExtension(newExtensionDir: string, targetDir: string): boolean {
  const validation = validateExtensionDir(newExtensionDir)
  if (!validation.valid) {
    throw new Error(`待替换扩展不合法: ${validation.error}`)
  }

  const backupDir = `${targetDir}.bak.${Date.now()}`
  let hasBackup = false

  try {
    if (existsSync(targetDir)) {
      renameSync(targetDir, backupDir)
      hasBackup = true
    }
    mkdirSync(join(targetDir, '..'), { recursive: true })
    renameSync(newExtensionDir, targetDir)
    if (hasBackup) {
      rmSync(backupDir, { recursive: true, force: true })
    }
    return true
  } catch (err) {
    // 回滚恢复旧版
    if (hasBackup && existsSync(backupDir)) {
      try {
        rmSync(targetDir, { recursive: true, force: true })
        renameSync(backupDir, targetDir)
      } catch {}
    }
    throw new Error(`原子替换扩展失败并已尝试回滚: ${err instanceof Error ? err.message : String(err)}`)
  }
}
