/** SSE 依赖的最小 Fastify reply 形状（窄结构类型，避免依赖 fastify 类型包）。 */
interface SseRawReply {
  writeHead(statusCode: number, headers?: Record<string, string>): unknown
  write(chunk: string): unknown
  end(): unknown
}

export interface SseReplyLike {
  raw: SseRawReply
}

/**
 * 可复用的 Server-Sent Events（SSE）响应封装。
 *
 * 基于 Fastify reply.raw 原语，屏蔽手写 header / `data:` 帧 / 结束 的样板，
 * 统一错误事件协议：正常用 `send`，出错用 `error`，结束用 `end`。
 */
export class SseStream {
  private ended = false

  constructor(private readonly reply: SseReplyLike) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
  }

  /** 发送一个结构化事件：`data: {"type":..., "data":...}`。 */
  send(type: string, data: unknown): this {
    if (this.ended) return this
    this.reply.raw.write(`data: ${JSON.stringify({ type, data })}\n\n`)
    return this
  }

  /** 发送错误事件（约定 type = 'error'）。 */
  error(message: string): this {
    return this.send('error', { message })
  }

  /** 关闭 SSE 流。 */
  end(): void {
    if (this.ended) return
    this.ended = true
    this.reply.raw.end()
  }
}
