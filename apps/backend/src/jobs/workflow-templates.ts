import { QUEUE_NAMES } from '../queue/queue-names'

export interface FlowStep {
  name: string
  queueName: string
  stage: string
}

export interface FlowTemplate {
  name: string
  type: string
  steps: FlowStep[]
  finalizerQueue: string
}

// 兼容旧类型别名与外部引用
export interface WorkflowNode {
  name: string
  queueName: string
  stage?: string
  data?: Record<string, any>
  children?: WorkflowNode[]
}

export const STAGE_SEQUENCE: Record<string, string[]> = {
  analysis: ['queued', 'collecting', 'uploading', 'analyzing', 'reporting', 'success', 'failure', 'cancelled'],
  image_gen: ['queued', 'prompting', 'generating', 'reviewing', 'success', 'failure', 'cancelled'],
  listing: ['queued', 'uploading_assets', 'submitting_listing', 'success', 'failure', 'cancelled'],
}

const TERMINAL = new Set(['success', 'failure', 'cancelled'])

export function canTransition(type: string, from: string, to: string) {
  const sequence = STAGE_SEQUENCE[type] ?? STAGE_SEQUENCE.analysis
  const fromIndex = sequence.indexOf(from)
  const toIndex = sequence.indexOf(to)
  if (fromIndex === -1 || toIndex === -1) return false
  if (TERMINAL.has(from)) return false
  if (TERMINAL.has(to)) return true
  return toIndex === fromIndex + 1
}

export function getFlowTemplate(type: string): FlowTemplate {
  if (type === 'image-gen' || type === 'image_gen') {
    return {
      name: 'image-flow',
      type: 'image-gen',
      steps: [
        { name: 'generate', queueName: QUEUE_NAMES.serverImageGen, stage: 'generating' },
      ],
      finalizerQueue: QUEUE_NAMES.flowFinalizer,
    }
  }
  if (type === 'listing') {
    return {
      name: 'listing-flow',
      type: 'listing',
      steps: [
        { name: 'submit', queueName: QUEUE_NAMES.serverListing, stage: 'submitting_listing' },
      ],
      finalizerQueue: QUEUE_NAMES.flowFinalizer,
    }
  }
  return {
    name: 'analysis-flow',
    type: 'analysis',
    steps: [
      { name: 'report', queueName: QUEUE_NAMES.serverReport, stage: 'analyzing' },
    ],
    finalizerQueue: QUEUE_NAMES.flowFinalizer,
  }
}
