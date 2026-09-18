import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

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

const prisma = new PrismaClient()
const jobsInDb = await prisma.job.findMany({ where: { businessKey: first.businessKey } })

const result = {
  sameJobId: first.jobId === second.jobId,
  firstCreated: first.created,
  secondCreated: second.created,
  dbCount: jobsInDb.length,
}
console.log(JSON.stringify(result))

await prisma.job.deleteMany({ where: { businessKey: first.businessKey } })
await prisma.$disconnect()

const ok = result.sameJobId && result.firstCreated && !result.secondCreated && result.dbCount === 1
process.exit(ok ? 0 : 1)

