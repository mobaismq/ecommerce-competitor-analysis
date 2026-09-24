import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret } from './ai-secret'

const dirs: string[] = []
afterEach(() => {
  delete process.env.AI_LOCAL_ENCRYPT_KEY
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('ai-secret', () => {
  it('encrypt → decrypt round trip', () => {
    dirs.push(mkdtempSync(join(tmpdir(), 'ai-sec-')))
    process.env.ECOMMERCE_DATA_ROOT = dirs[0]
    process.env.AI_LOCAL_ENCRYPT_KEY = 'test-local-key-123'
    const plain = 'sk-or-v1-abcdef123456'
    const enc = encryptSecret(plain)
    expect(enc.startsWith('enc:v1:')).toBe(true)
    expect(enc).not.toContain(plain)
    expect(decryptSecret(enc)).toBe(plain)
  })

  it('plaintext (未加密) 原样返回，向后兼容', () => {
    expect(decryptSecret('sk-plaintext-xyz')).toBe('sk-plaintext-xyz')
    expect(decryptSecret('')).toBe('')
  })

  it('固定 env 密钥下每次加密结果不同（随机 IV），但均可解密', () => {
    dirs.push(mkdtempSync(join(tmpdir(), 'ai-sec2-')))
    process.env.ECOMMERCE_DATA_ROOT = dirs[1]
    process.env.AI_LOCAL_ENCRYPT_KEY = 'fixed-key'
    const a = encryptSecret('secret')
    const b = encryptSecret('secret')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('secret')
    expect(decryptSecret(b)).toBe('secret')
  })
})