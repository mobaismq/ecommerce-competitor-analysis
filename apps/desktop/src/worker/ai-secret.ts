import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataRoots } from '../main/data-root'

/**
 * 简单本机密文工具（AES-256-GCM）：用于 AI 配置类密钥（ai-self.json 等）落盘时加密，避免明文躺在磁盘上。
 * 密钥来源：env `AI_LOCAL_ENCRYPT_KEY`（可自行指定），否则首次调用生成一个并持久化到 `~/.ecommerce/config/ai-encrypt.key`。
 * ⚠️ 说明：这是“简单加密/防随手读”，密钥若随包分发只能防粗心者；要真正防泄露，核心仍是不把密钥随应用打包（走服务端登录下发）。
 */
const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

function deriveKey(raw: string): Buffer {
  return createHash('sha256').update(raw).digest()
}

export function getEncryptionKey(env: Record<string, string | undefined> = process.env): string {
  const fromEnv = (env.AI_LOCAL_ENCRYPT_KEY ?? '').trim()
  if (fromEnv) return fromEnv
  const file = join(resolveDataRoots(env).internalRoot, 'config', 'ai-encrypt.key')
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const key = randomBytes(32).toString('hex')
  mkdirSync(join(resolveDataRoots(env).internalRoot, 'config'), { recursive: true })
  writeFileSync(file, key, 'utf8')
  return key
}

/** 加密明文；返回 "enc:v1:<iv>:<tag>:<data>" base64 串。 */
export function encryptSecret(plain: string, key: string = getEncryptionKey(), env: Record<string, string | undefined> = process.env): string {
  const k = deriveKey(getEncryptionKey(env))
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, k, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

/** 解密；非 "enc:v1:" 前缀（旧明文）原样返回，保持向后兼容。 */
export function decryptSecret(payload: string, _key?: string, env: Record<string, string | undefined> = process.env): string {
  if (!payload || !payload.startsWith(PREFIX)) return payload
  const k = deriveKey(getEncryptionKey(env))
  const parts = payload.split(':')
  if (parts.length !== 5) return payload
  const [, , ivB, tagB, dataB] = parts
  try {
    const decipher = createDecipheriv(ALGO, k, Buffer.from(ivB, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return payload
  }
}