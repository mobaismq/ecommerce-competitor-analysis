import { Writable } from 'stream'
import { existsSync, statSync, openSync, closeSync, writeSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { multistream, transport } from 'pino'

const MAX_BYTES = 5 * 1024 * 1024

class RotatingFileStream extends Writable {
  private filePath: string
  private size: number

  constructor(filePath: string) {
    super()
    this.filePath = filePath
    this.size = existsSync(filePath) ? statSync(filePath).size : 0
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    const line = chunk.toString()
    const bytes = Buffer.byteLength(line)
    if (this.size + bytes > MAX_BYTES) {
      const rotated = `${this.filePath}.1`
      try { unlinkSync(rotated) } catch { /* 不存在则忽略 */ }
      try { renameSync(this.filePath, rotated) } catch { /* 首次轮转无当前文件则忽略 */ }
      try { unlinkSync(rotated) } catch { /* 只保留当前文件 */ }
      this.size = 0
    }
    const fd = openSync(this.filePath, 'a')
    writeSync(fd, line)
    closeSync(fd)
    this.size += bytes
    callback()
  }
}

export function buildPinoStream(dev: boolean) {
  const logDir = join(process.cwd(), 'logs')
  const app = new RotatingFileStream(join(logDir, 'app.log'))
  const error = new RotatingFileStream(join(logDir, 'error.log'))
  const streams = [
    { stream: app, level: 'info' },
    { stream: error, level: 'warn' },
  ]
  if (dev) {
    streams.push({ stream: transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }), level: 'debug' })
    streams.push({ stream: new RotatingFileStream(join(logDir, 'debug.log')), level: 'debug' })
  } else {
    streams.push({ stream: process.stdout, level: 'info' })
  }
  return multistream(streams)
}
