import { FlowProducer, Queue, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6380'
const connection = new IORedis(url, { maxRetriesPerRequest: null })
const suffix = Date.now()
const queueName = `smoke-${suffix}`
const parentQueue = `smoke-parent-${suffix}`
const childQueue = `smoke-child-${suffix}`

const queue = new Queue(queueName, { connection })
const events = new QueueEvents(queueName, { connection })
const flowProducer = new FlowProducer({ connection })

await queue.waitUntilReady()
const job = await queue.add('smoke', { value: 42 })
const worker = new Worker(queueName, async (currentJob) => {
  await currentJob.updateProgress(100)
  return { consumed: currentJob.data.value }
}, { connection })

const completed = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('consume timeout')), 10000)
  events.on('completed', ({ jobId, returnvalue }) => {
    if (jobId === job.id) {
      clearTimeout(timer)
      resolve(typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue)
    }
  })
})

const flow = await flowProducer.add({
  name: 'parent-smoke',
  queueName: parentQueue,
  data: { flow: true },
  children: [
    {
      name: 'child-smoke',
      queueName: childQueue,
      data: { flowChild: true },
    },
  ],
})

const result = {
  completed,
  flowParentId: flow.job.id,
  flowChildren: flow.children?.length ?? 0,
}
console.log(JSON.stringify(result))

await worker.close()
await events.close()
await queue.close()
await flowProducer.close()
await connection.quit()

const ok = completed.consumed === 42 && result.flowChildren === 1
process.exit(ok ? 0 : 1)
