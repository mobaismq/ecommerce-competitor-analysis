import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { handleRequest } from './apiHandler.js'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 独立服务不经过 Vite，需手动加载 app/.env 环境变量
const envFile = path.join(APP_DIR, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const PORT = Number(process.env.API_PORT || 8787)

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  handleRequest(req, res).catch((error) => {
    try {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    } catch {
      res.end()
    }
  })
})

server.listen(PORT, () => {
  console.log(`独立后端服务已启动：http://localhost:${PORT}`)
})
