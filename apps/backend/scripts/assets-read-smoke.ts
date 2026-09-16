import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { hashPassword } from '../src/auth/password'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

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

async function login(username: string, password: string) {
  const response = await fetch('http://127.0.0.1:8787/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const payload = (await response.json()) as { accessToken?: string }
  return { status: response.status, token: payload.accessToken ?? '' }
}

async function main() {
  loadBackendEnv()
  const dir = mkdtempSync(join(tmpdir(), 'eca-assets-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = dir
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const storageKey = 'test/assets/main.png'
  const absolute = join(dir, storageKey)
  mkdirSync(join(dir, 'test/assets'), { recursive: true })
  writeFileSync(absolute, 'png-bytes')
  const asset = await prisma.generatedAsset.create({
    data: {
      tenantId: tenant.id,
      runId: 'run-1',
      storageKey,
      mimeType: 'image/png',
      size: 9,
      originalName: 'main.png',
      sourceUrl: 'https://example.com/1.png',
    },
  })
  const noPermUser = `no-perm-${suffix}`
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      username: noPermUser,
      passwordHash: hashPassword('NoPerm123!'),
      displayName: '无权限用户',
      dataScope: 'all',
      isActive: true,
    },
  })

  execFileSync('pnpm', ['--filter', 'backend', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
  const api = spawn('node', ['dist/src/main.js'], { cwd: backendRoot, stdio: 'ignore' })
  let adminFindStatus = 0
  let adminRawStatus = 0
  let noPermFindStatus = 0
  let noPermRawStatus = 0
  let missingStatus = 0
  let rawText = ''
  let rawMime = ''
  let fields: Record<string, unknown> = {}
  try {
    const ready = await waitForApi(api)
    if (!ready) throw new Error('api not ready')
    const envText = readFileSync(join(backendRoot, '.env'), 'utf8')
    const passwordLine = envText.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='))
    const adminPassword = passwordLine ? passwordLine.slice('ADMIN_PASSWORD='.length) : 'change-me'
    const admin = await login(process.env.ADMIN_USERNAME || 'admin', adminPassword)
    const authHeaders = { authorization: `Bearer ${admin.token}`, 'content-type': 'application/json' }

    const findResponse = await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}`, { headers: authHeaders })
    adminFindStatus = findResponse.status
    const findBody = (await findResponse.json()) as Record<string, unknown>
    fields = { storageKey: findBody.storageKey, mimeType: findBody.mimeType, size: findBody.size, runId: findBody.runId, sourceUrl: findBody.sourceUrl }

    const rawResponse = await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}/raw`, { headers: authHeaders })
    adminRawStatus = rawResponse.status
    rawMime = rawResponse.headers.get('content-type') ?? ''
    rawText = await rawResponse.text()

    const noPerm = await login(noPermUser, 'NoPerm123!')
    const noPermHeaders = { authorization: `Bearer ${noPerm.token}`, 'content-type': 'application/json' }
    noPermFindStatus = (await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}`, { headers: noPermHeaders })).status
    noPermRawStatus = (await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}/raw`, { headers: noPermHeaders })).status

    missingStatus = (await fetch('http://127.0.0.1:8787/api/assets/not-exist-id', { headers: authHeaders })).status
  } finally {
    if (api && !api.killed) api.kill('SIGTERM')
  }

  const output = {
    http: { adminFindStatus, adminRawStatus, noPermFindStatus, noPermRawStatus, missingStatus },
    raw: { mime: rawMime, text: rawText },
    fields,
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { id: asset.id } })
  await prisma.user.deleteMany({ where: { username: noPermUser } })
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    adminFindStatus === 200 &&
    adminRawStatus === 200 &&
    noPermFindStatus === 403 &&
    noPermRawStatus === 403 &&
    missingStatus === 404 &&
    rawMime.startsWith('image/png') &&
    rawText === 'png-bytes' &&
    fields.storageKey === storageKey &&
    fields.mimeType === 'image/png' &&
    fields.size === 9 &&
    fields.runId === 'run-1' &&
    fields.sourceUrl === 'https://example.com/1.png'
  process.exit(ok ? 0 : 1)
}

void main()
