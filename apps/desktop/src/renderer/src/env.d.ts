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
    }
  }
}
