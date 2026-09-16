import { createHmac } from 'node:crypto'

export interface UploadTicketClaims {
  uploadId: string
  storageKey: string
  bizType: string
  expiresAt: Date
}

function secret() {
  return process.env.STORAGE_UPLOAD_SECRET || 'dev-upload-secret'
}

export function signUploadTicket(claims: UploadTicketClaims) {
  const payload = [claims.uploadId, claims.storageKey, claims.bizType, claims.expiresAt.getTime()].join('|')
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export function verifyUploadTicket(claims: UploadTicketClaims, sign?: string) {
  if (!sign) return false
  const expected = signUploadTicket(claims)
  if (sign !== expected) return false
  return claims.expiresAt.getTime() > Date.now()
}
