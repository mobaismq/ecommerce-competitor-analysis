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
          resumeJobId?: string
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
        probeChrome: () => Promise<{
          installed: boolean
          path?: string
          version?: string
          downloadUrl: string
        }>
        openExternalUrl: (url: string) => Promise<{ ok: boolean }>
        openLoginView: () => Promise<{
          ok: boolean
          port?: number
          targetId?: string
        }>
        /** 兼容别名：行为与 openLoginView 相同（方案 A：真实窗口直登）。 */
        openLoginWindow: () => Promise<{
          ok: boolean
          port?: number
          targetId?: string
        }>
        /** 停止登录视图：SSO 同步中首次调用会被拦截（ok:false + reason），需二次确认后强制关闭。 */
        stopLoginView: () => Promise<{ ok: boolean; reason?: string; state?: string }>
        checkLoginStatus: () => Promise<{
          isLoggedIn: boolean
          taobaoUid?: string
          taobaoNick?: string
          diagnostics?: {
            mode: string
            webdriverExposed?: boolean
            note?: string
          }
        }>
        getSpeedConfig?: () => Promise<{
          ok: boolean
          filePath: string
          activeProfile: string
          profile: Record<string, number>
          defaultProfile: Record<string, number>
          fieldExplanations: Record<string, string>
          error?: string
        }>
        saveSpeedConfig?: (input: { profile: Record<string, number> }) => Promise<{
          ok: boolean
          filePath: string
          error?: string
        }>
        /** 登录授权状态订阅：idle / opening / waiting-sso / verified。 */
        onLoginState: (listener: (state: { state: 'idle' | 'opening' | 'waiting-sso' | 'verified' }) => void) => () => void
      }
    }
  }
}
