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
      files: {
        saveImageBatch: (input: {
          folderName?: string
          kind?: 'main' | 'detail'
          files: Array<{ name: string; data: Uint8Array }>
        }) => Promise<{ ok: boolean; folderPath: string; count: number; files: string[] }>
        saveImage: (input: {
          folderName?: string
          kind?: 'main' | 'detail'
          name: string
          data: Uint8Array
        }) => Promise<{ ok: boolean; folderPath: string; path: string; name: string }>
      }
      capabilities: {
        invoke: (capability: string, payload?: unknown) => Promise<unknown>
        onStream: (listener: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void) => () => void
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
          tenantId?: string
          keyword?: string
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
        openLoginView: () => Promise<{
          ok: boolean
          port?: number
          targetId?: string
          viewport?: { width: number; height: number }
        }>
        /** 兼容别名：行为与 openLoginView 相同（不再打开外部窗口）。 */
        openLoginWindow: () => Promise<{
          ok: boolean
          port?: number
          targetId?: string
          viewport?: { width: number; height: number }
        }>
        stopLoginView: () => Promise<{ ok: boolean }>
        sendLoginInput: (input: {
          type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
          x: number
          y: number
          button?: 'left' | 'right' | 'middle' | 'none'
          clickCount?: number
        }) => Promise<{ ok: boolean }>
        onScreencastFrame: (listener: (frame: { data: string; width: number; height: number; timestamp: number }) => void) => () => void
        onScreencastStatus: (listener: (status: { status: string; error?: string }) => void) => () => void
      }
    }
  }
}
