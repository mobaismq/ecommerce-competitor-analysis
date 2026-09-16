import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendEnv = join(desktopRoot, '..', 'backend', '.env')
const envText = readFileSync(backendEnv, 'utf8')
const passwordLine = envText.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='))
const adminPassword = passwordLine ? passwordLine.slice('ADMIN_PASSWORD='.length) : 'change-me'
const base = process.env.BACKEND_URL || 'http://127.0.0.1:8787'

async function post(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  return { status: response.status, data }
}

const login = await post('/api/auth/login', { username: 'admin', password: adminPassword })
const token = login.data.accessToken
const auth = { authorization: `Bearer ${token}` }

const created = await post(
  '/api/jobs',
  { type: 'analysis', storeId: `desktop-agent-smoke-${Date.now()}`, keyword: 'desktop agent smoke', analysisType: 'market' },
  auth,
)
const jobId = created.data.jobId

const registered = await post(
  '/api/agent/register',
  { name: 'desktop-smoke-agent', platform: process.platform, version: '0.1.0', capabilities: ['rpa'] },
  auth,
)
const agentId = registered.data.agentId
const agentSecret = registered.data.deviceSecret
const agentHeaders = { 'x-agent-id': agentId, 'x-agent-secret': agentSecret }

const claimed = await post('/api/agent/tasks/claim', {}, agentHeaders)
const accepted = await post(`/api/agent/tasks/${jobId}/accept`, {}, agentHeaders)
const heartbeat = await post(`/api/agent/tasks/${jobId}/heartbeat`, {}, agentHeaders)
const completed = await post(`/api/agent/tasks/${jobId}/complete`, { result: { downloaded: 3 } }, agentHeaders)

const job = await fetch(`${base}/api/jobs/${jobId}`, { headers: auth }).then((response) => response.json())

const result = {
  registered: registered.status,
  claimedJob: claimed.data.jobId,
  accepted: accepted.status,
  heartbeat: heartbeat.status,
  completed: completed.status,
  jobStatus: job.status,
  jobStage: job.stage,
}
console.log(JSON.stringify(result))

const ok =
  registered.status === 201 &&
  claimed.data.jobId === jobId &&
  accepted.status === 201 &&
  heartbeat.status === 201 &&
  completed.status === 201 &&
  job.status === 'success'
process.exit(ok ? 0 : 1)
