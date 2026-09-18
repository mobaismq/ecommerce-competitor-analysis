import { QUEUE_NAMES } from '../queue/queue-names'

export interface WorkflowNode {
  name: string
  queueName: string
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

export function getFlowTemplate(type: string): WorkflowNode {
  if (type === 'image-gen' || type === 'image_gen') {
    return {
      name: 'image-flow',
      queueName: QUEUE_NAMES.flowFinalizer,
      data: {},
      children: [
        {
          name: 'generate',
          queueName: QUEUE_NAMES.serverImageGen,
          data: {},
          children: [{ name: 'prompt', queueName: QUEUE_NAMES.serverAi, data: {} }],
        },
      ],
    }
  }
  if (type === 'listing') {
    return {
      name: 'listing-flow',
      queueName: QUEUE_NAMES.flowFinalizer,
      data: {},
      children: [
        {
          name: 'submit',
          queueName: QUEUE_NAMES.serverListing,
          data: {},
          children: [{ name: 'upload-assets', queueName: QUEUE_NAMES.serverImageGen, data: {} }],
        },
      ],
    }
  }
  return {
    name: 'analysis-flow',
    queueName: QUEUE_NAMES.flowFinalizer,
    data: {},
    children: [
      {
        name: 'report',
        queueName: QUEUE_NAMES.serverReport,
        data: {},
        children: [
          {
            name: 'analyze',
            queueName: QUEUE_NAMES.serverAi,
            data: {},
          },
        ],
      },
    ],
  }
}
