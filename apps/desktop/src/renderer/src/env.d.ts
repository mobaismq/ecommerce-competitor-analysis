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
      capabilities: {
        invoke: (capability: string, payload?: unknown) => Promise<unknown>
      }
      collection: {
        start: (input?: {
          productName?: string
          productUrl?: string
          minPrice?: number | null
          maxPrice?: number | null
          topN?: number
          searchPages?: number
          speedProfile?: string
          importMysql?: boolean
          mode?: string
          downloadScript?: string
          fake?: boolean
        }) => Promise<{ jobId: string; mode: string; runDir?: string; logFile?: string; pid?: number }>
        cancel: () => Promise<{ cancelled: boolean; reason?: string; jobId?: string }>
        status: (jobId?: string) => Promise<{
          jobId: string
          status: string
          type: string | null
          pid?: number | null
          runDir?: string
          logFile?: string
          logTail?: string
          input?: Record<string, unknown>
          createdAt: string
          finishedAt: string | null
          errorMessage: string | null
          resultJson: unknown
          stages: unknown[]
          sync: unknown[]
        } | null>
        list: (limit?: number) => Promise<Array<{
          id: string
          jobId: string
          type: string
          status: string
          pid?: number | null
          createdAt: string
          finishedAt: string | null
          errorMessage: string | null
          input?: Record<string, unknown>
        }>>
        probe: () => Promise<{
          python: string
          hasDownloadScript: boolean
          downloadScript: string
        }>
      }
    }
  }
}
