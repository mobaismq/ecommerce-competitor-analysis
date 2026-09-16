import * as crypto from 'crypto'

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const candidate = crypto.scryptSync(password, parts[0], 64)
  return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), candidate)
}
