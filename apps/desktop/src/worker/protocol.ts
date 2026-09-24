/** main ↔ capability worker 消息协议。双方共用同一类型定义。 */

export type CapabilityName = 'ping' | string

export interface CapabilityInvokeMessage {
  type: 'capability-invoke'
  msgId: string
  capability: CapabilityName
  payload?: unknown
}

export interface CapabilityAckMessage {
  type: 'capability-ack'
  msgId: string
  capability: CapabilityName
}

export interface CapabilityResultMessage {
  type: 'capability-result'
  msgId: string
  capability: CapabilityName
  result: unknown
}

/** 流式推送：worker 在处理某次调用时逐块下发的中间事件（如 AI 帮写的 thinking/content/done）。 */
export interface CapabilityStreamMessage {
  type: 'capability-stream'
  msgId: string
  capability: CapabilityName
  event: { type: string; text?: string; data?: Record<string, unknown> }
}

export interface CapabilityErrorMessage {
  type: 'capability-error'
  msgId: string
  capability: CapabilityName
  error: { code: string; message: string }
}

export interface WorkerReadyMessage {
  type: 'worker-ready'
  pid?: number
}

export type WorkerInbound = CapabilityInvokeMessage
export type WorkerOutbound = WorkerReadyMessage | CapabilityAckMessage | CapabilityResultMessage | CapabilityErrorMessage | CapabilityStreamMessage

export function isInvoke(msg: unknown): msg is CapabilityInvokeMessage {
  return !!msg && typeof msg === 'object' && (msg as { type?: string }).type === 'capability-invoke'
}
