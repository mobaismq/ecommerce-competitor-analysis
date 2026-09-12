import 'reflect-metadata'

async function bootstrapWorker() {
  process.stdout.write(JSON.stringify({ level: 30, msg: 'worker ready', service: 'ecommerce-worker' }) + '\n')
}

bootstrapWorker()
