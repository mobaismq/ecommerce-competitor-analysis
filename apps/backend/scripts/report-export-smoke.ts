import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { hashPassword } from '../src/auth/password'
import { loadBackendEnv } from '../src/env'
import { ReportExportService } from '../src/reports/report-export.service'
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
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (api.exitCode !== null) throw new Error(`api exited early with ${api.exitCode}`)
  return false
}

async function main() {
  loadBackendEnv()
  const exportDir = join(tmpdir(), `eca-report-export-${Date.now()}`)
  mkdirSync(exportDir, { recursive: true })
  process.env.REPORT_EXPORT_DIR = exportDir
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)

  const job = await prisma.job.create({
    data: { tenantId: tenant.id, type: 'analysis', businessKey: `export-${suffix}`, status: 'success', stage: 'success' },
  })
  const run = await prisma.analysisRun.create({
    data: {
      tenantId: tenant.id,
      jobId: job.id,
      analysisType: 'market',
      status: 'success',
      reportNo: `REX${suffix}`,
      competitorCount: 1,
      reportJson: { summary: '测试报告总结', priceBands: [{ bandName: '低', productCount: 2 }], insights: [{ type: 'summary', title: 'AI 总结', content: '测试洞察' }] },
    },
  })

  const service = new ReportExportService(prisma)
  const jsonFirst = await service.exportReport({ runId: run.id, tenantId: tenant.id, format: 'json' })
  const jsonSecond = await service.exportReport({ runId: run.id, tenantId: tenant.id, format: 'json' })
  const markdown = await service.exportReport({ runId: run.id, tenantId: tenant.id, format: 'markdown' })
  const html = await service.exportReport({ runId: run.id, tenantId: tenant.id, format: 'html' })
  const exportRows = await prisma.generatedAsset.count({ where: { runId: run.id, storageKey: { startsWith: 'report-exports/' } } })
  const jsonFileExists = existsSync(join(exportDir, `${run.id}/json`))

  execFileSync('pnpm', ['--filter', 'backend', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
  const api = spawn('node', ['dist/src/main.js'], { cwd: backendRoot, stdio: 'ignore' })
  let adminStatus = 0
  let noPermStatus = 0
  let noPermUser: string | null = null
  try {
    const ready = await waitForApi(api)
    if (!ready) throw new Error('api not ready')
    const envText = readFileSync(join(backendRoot, '.env'), 'utf8')
    const passwordLine = envText.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='))
    const adminPassword = passwordLine ? passwordLine.slice('ADMIN_PASSWORD='.length) : 'change-me'
    const adminLogin = await fetch('http://127.0.0.1:8787/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password: adminPassword }),
    }).then((res) => res.json() as Promise<{ accessToken?: string }>)

    const doExport = async (token: string) => {
      const response = await fetch(`http://127.0.0.1:8787/api/reports/${run.id}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: 'json' }),
      })
      return response.status
    }
    adminStatus = await doExport(adminLogin.accessToken ?? '')

    noPermUser = `no-perm-${suffix}`
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
    const userLogin = await fetch('http://127.0.0.1:8787/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: noPermUser, password: 'NoPerm123!' }),
    }).then((res) => res.json() as Promise<{ accessToken?: string }>)
    noPermStatus = await doExport(userLogin.accessToken ?? '')
  } finally {
    if (api && !api.killed) api.kill('SIGTERM')
  }

  const output = {
    service: { jsonStorage: jsonFirst.storageKey, jsonReused: jsonSecond.reused, markdownStorage: markdown.storageKey, htmlStorage: html.storageKey, exportRows, jsonFileExists },
    http: { adminStatus, noPermStatus },
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { runId: run.id } })
  await prisma.analysisRun.deleteMany({ where: { id: run.id } })
  await prisma.job.deleteMany({ where: { id: job.id } })
  if (noPermUser) await prisma.user.deleteMany({ where: { username: noPermUser } })
  await prisma.$disconnect()
  rmSync(exportDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    jsonFirst.storageKey === `report-exports/${run.id}/json` &&
    jsonSecond.reused === true &&
    markdown.storageKey.includes('/markdown') &&
    html.storageKey.includes('/html') &&
    exportRows === 3 &&
    jsonFileExists &&
    adminStatus === 201 &&
    noPermStatus === 403
  process.exit(ok ? 0 : 1)
}

void main()
