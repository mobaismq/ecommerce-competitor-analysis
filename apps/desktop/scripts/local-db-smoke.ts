import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalClient, runLocalCleanup } from '../src/main/local-db-core'

async function main() {
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(root, '..')
const tmp = join(tmpdir(), `eca-local-db-smoke-${Date.now()}`)
const dbUrl = `file:${join(tmp, 'smoke.db')}`
const filesDir = join(tmp, 'files')

mkdirSync(filesDir, { recursive: true })

execFileSync(process.execPath, [join(root, 'scripts/apply-local-migration.mjs')], {
  cwd: workspaceRoot,
  stdio: 'inherit',
  env: { ...process.env, DESKTOP_DB_URL: dbUrl },
})

const prisma = createLocalClient(dbUrl)

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)
const oldFile = join(filesDir, 'old.html')
const recentFile = join(filesDir, 'recent.json')
const queuedFile = join(filesDir, 'queued.html')
const blockedDir = join(filesDir, 'blocked')
const profileFile = join(filesDir, 'profile.json')
writeFileSync(oldFile, 'old')
writeFileSync(recentFile, 'recent-data')
writeFileSync(queuedFile, 'queued')
writeFileSync(profileFile, '{"login":"keep"}')
mkdirSync(blockedDir)

const oldJob = await prisma.localJob.create({
  data: {
    id: 'old-job',
    jobId: 'job-old',
    type: 'analysis',
    status: 'success',
    finishedAt: daysAgo(40),
    updatedAt: daysAgo(40),
    events: {
      create: [{ id: 'event-old', type: 'done', data: '{}' }],
    },
    tempFiles: {
      create: [
        { id: 'file-old', kind: 'html', path: oldFile, size: 3, status: 'finished' },
        { id: 'file-blocked', kind: 'html', path: blockedDir, size: 1, status: 'finished' },
      ],
    },
  },
})

const recentJob = await prisma.localJob.create({
  data: {
    id: 'recent-job',
    jobId: 'job-recent',
    type: 'analysis',
    status: 'success',
    finishedAt: daysAgo(1),
    updatedAt: daysAgo(1),
    tempFiles: {
      create: [{ id: 'file-recent', kind: 'json', path: recentFile, size: 11, status: 'finished' }],
    },
  },
})

await prisma.localJob.create({
  data: {
    id: 'queued-job',
    jobId: 'job-queued',
    type: 'analysis',
    status: 'queued',
    tempFiles: {
      create: [{ id: 'file-queued', kind: 'html', path: queuedFile, size: 6, status: 'active' }],
    },
  },
})

await prisma.localJob.create({
  data: {
    id: 'running-job',
    jobId: 'job-running',
    type: 'analysis',
    status: 'running',
    tempFiles: {
      create: [{ id: 'file-running', kind: 'json', path: join(filesDir, 'running.json'), size: 4, status: 'active' }],
    },
  },
})

const first = await runLocalCleanup(prisma, {
  recordRetentionDays: 30,
  fileRetentionDays: 7,
  capBytes: 1,
  now: new Date(),
})
const afterFirst = await prisma.localJob.findMany({ include: { events: true, tempFiles: true } })
const oldExists = afterFirst.some((job) => job.id === oldJob.id)
const recentExists = afterFirst.some((job) => job.id === recentJob.id)
const queuedExists = afterFirst.some((job) => job.id === 'queued-job')
const runningExists = afterFirst.some((job) => job.id === 'running-job')

await runLocalCleanup(prisma, {
  recordRetentionDays: 30,
  fileRetentionDays: 7,
  capBytes: 1,
  now: new Date(),
})

const result = {
  first,
  oldJobRemoved: !oldExists,
  recentJobKept: recentExists,
  queuedKept: queuedExists,
  runningKept: runningExists,
  oldFileRemoved: !oldExists,
  recentFileRemoved: recentExists,
  profileKept: existsSync(profileFile),
}

console.log(JSON.stringify(result))
await prisma.$disconnect()
rmSync(tmp, { recursive: true, force: true })

const ok = first.deletedJobs === 1 && result.oldJobRemoved && result.recentJobKept && result.queuedKept && result.runningKept && result.oldFileRemoved && result.profileKept
process.exit(ok ? 0 : 1)
}

void main()
