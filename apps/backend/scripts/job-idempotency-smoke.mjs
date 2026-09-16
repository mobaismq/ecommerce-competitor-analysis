import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(root, '.env'), 'utf8')
const passwordLine = env.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='))
const password = passwordLine ? passwordLine.slice('ADMIN_PASSWORD='.length) : 'change-me'
const base = 'http://127.0.0.1:8787'

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password }),
}).then((res) => res.json())
const token = login.accessToken

const body = {
  type: 'analysis',
  storeId: 'idempotency-smoke',
  keyword: '  Same Keyword  ',
  analysisType: 'market',
}
const headers = {
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
}

const first = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify(body) }).then((res) => res.json())
const second = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify(body) }).then((res) => res.json())

const connection = new IORedis('redis://127.0.0.1:6380', { maxRetriesPerRequest: null })
const queue = new Queue('desktop-rpa', { connection })
const queueJob = await queue.getJob(first.jobId)
const activeJobs = (await queue.getJobs(['waiting', 'active', 'delayed'])).filter((job) => job.id === first.jobId)

const result = {
  sameJobId: first.jobId === second.jobId,
  firstCreated: first.created,
  secondCreated: second.created,
  queueJobResolved: queueJob?.id === first.jobId,
  activeJobCount: activeJobs.length,
}
console.log(JSON.stringify(result))

if (queueJob) await queue.remove(first.jobId)
await queue.close()
await connection.quit()

const prisma = new PrismaClient()
await prisma.job.deleteMany({ where: { businessKey: first.businessKey } })
await prisma.$disconnect()

const ok = result.sameJobId && result.firstCreated && !result.secondCreated && result.queueJobResolved && result.activeJobCount <= 1
process.exit(ok ? 0 : 1)
