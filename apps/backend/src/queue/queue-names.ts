export const QUEUE_NAMES = {
  desktopRpa: 'desktop-rpa',
  serverAi: 'server-ai',
  serverReport: 'server-report',
  serverImageGen: 'server-image-gen',
  serverListing: 'server-listing',
  flowFinalizer: 'flow-finalizer',
} as const

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES)
