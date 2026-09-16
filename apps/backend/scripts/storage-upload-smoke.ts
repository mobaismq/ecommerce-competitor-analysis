import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { signUploadTicket } from '../src/storage/upload-ticket'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

interface SignedHeaders {
  [key: string]: string | undefined
}

async function waitForApi(api: ChildProcess, timeoutMs = 25000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch('http://127.0.0.1:8787/api/health/live')
      if (response.ok) return true
    } catch {
      // still booting
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  if (api.exitCode !== null) throw new Error(`api exited early with ${api.exitCode}`)
  return false
}

async function main() {
  loadBackendEnv()
  const dir = mkdtempSync(join(tmpdir(), 'eca-storage-upload-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = dir
  process.env.STORAGE_UPLOAD_SECRET = 'smoke-secret'
  process.env.STORAGE_PREFIX = 'dev'
  const prisma = new PrismaService()

  execFileSync('pnpm', ['--filter', 'backend', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
  const api = spawn('node', ['dist/src/main.js'], { cwd: backendRoot, stdio: 'ignore' })
  let signStatus = 0
  let putStatus = 0
  let confirmStatus = 0
  let forgedStatus = 0
  let expiredStatus = 0
  let storageKey = ''
  let confirmBody: { assetId?: string } = {}
  try {
    const ready = await waitForApi(api)
    if (!ready) throw new Error('api not ready')
    const envText = readFileSync(join(backendRoot, '.env'), 'utf8')
    const passwordLine = envText.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='))
    const password = passwordLine ? passwordLine.slice('ADMIN_PASSWORD='.length) : 'change-me'
    const login = await fetch('http://127.0.0.1:8787/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password }),
    }).then((res) => res.json() as Promise<{ accessToken?: string }>)
    const token = login.accessToken ?? ''
    const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

    const signResponse = await fetch('http://127.0.0.1:8787/api/storage/uploads', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ bizType: 'generated', runId: 'run-123', originalName: 'main.png', contentType: 'image/png' }),
    })
    signStatus = signResponse.status
    const ticket = (await signResponse.json()) as { uploadId: string; storageKey: string; uploadUrl: string; expiresAt: string; headers: Record<string, string> }
    storageKey = ticket.storageKey

    const putResponse = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { ...authHeaders, ...ticket.headers, 'content-type': 'application/octet-stream' },
      body: Buffer.from('fake-png'),
    })
    putStatus = putResponse.status

    const confirmPayload = {
      storageKey: ticket.storageKey,
      size: 8,
      sign: ticket.headers['x-upload-sign'],
      expiresAt: ticket.headers['x-upload-expires'],
      bizType: 'generated',
      runId: 'run-123',
      originalName: 'main.png',
      contentType: 'image/png',
    }
    const confirmResponse = await fetch(`http://127.0.0.1:8787/api/storage/uploads/${ticket.uploadId}/confirm`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(confirmPayload),
    })
    confirmStatus = confirmResponse.status
    confirmBody = (await confirmResponse.json()) as { assetId?: string }

    const forgedResponse = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { ...authHeaders, ...ticket.headers, 'x-upload-sign': 'forged', 'content-type': 'application/octet-stream' },
      body: Buffer.from('fake-png'),
    })
    forgedStatus = forgedResponse.status

    const expiredAt = new Date(Date.now() - 60_000)
    const expiredSign = signUploadTicket({ uploadId: ticket.uploadId, storageKey: ticket.storageKey, bizType: 'generated', expiresAt: expiredAt })
    const expiredResponse = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { ...authHeaders, ...ticket.headers, 'x-upload-expires': String(expiredAt.getTime()), 'x-upload-sign': expiredSign, 'content-type': 'application/octet-stream' },
      body: Buffer.from('fake-png'),
    })
    expiredStatus = expiredResponse.status
  } finally {
    if (api && !api.killed) api.kill('SIGTERM')
  }

  const asset = await prisma.generatedAsset.findUnique({ where: { storageKey } })
  const fileExists = existsSync(join(dir, storageKey))
  const output = {
    http: { signStatus, putStatus, confirmStatus, forgedStatus, expiredStatus },
    asset: { assetId: confirmBody.assetId != null, storageKey, fileExists, size: asset?.size },
  }
  console.log(JSON.stringify(output))

  if (storageKey) await prisma.generatedAsset.deleteMany({ where: { storageKey } })
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    signStatus === 201 &&
    putStatus === 200 &&
    confirmStatus === 201 &&
    output.asset.assetId &&
    output.asset.fileExists &&
    asset?.size === 8 &&
    forgedStatus === 401 &&
    expiredStatus === 401
  process.exit(ok ? 0 : 1)
}

void main()
