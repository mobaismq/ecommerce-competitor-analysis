export {}

declare global {
  interface Window {
    desktop?: {
      platform: string
      version: string
      store: {
        getToken: () => Promise<string | null>
        setToken: (token: string) => Promise<boolean>
        clearToken: () => Promise<boolean>
        getConfig: (key: string) => Promise<unknown>
        setConfig: (key: string, value: string | number | boolean) => Promise<boolean>
        clearConfig: (key: string) => Promise<boolean>
      }
      local: {
        getStats: () => Promise<{
          retentionDays: number
          tempFileCount: number
          tempBytes: number
          dbBytes: number
        }>
        runCleanup: () => Promise<{
          deletedJobs: number
          deletedJobFileCount: number
          deletedExpiredFiles: number
          deletedCapFiles: number
        }>
      }
      collection: {
        start: (input?: {
          productName?: string
          productUrl?: string
          mode?: string
          downloadScript?: string
          fake?: boolean
        }) => Promise<{ jobId: string; mode: string }>
        cancel: () => Promise<{ cancelled: boolean; reason: string }>
        status: (jobId?: string) => Promise<{
          jobId: string
          status: string
          type: string | null
          createdAt: string
          finishedAt: string | null
          errorMessage: string | null
          resultJson: unknown
          stages: unknown[]
          sync: unknown[]
        } | null>
        probe: () => Promise<{
          python: string
          hasDownloadScript: boolean
          downloadScript: string
        }>
      }
    }
  }
}
