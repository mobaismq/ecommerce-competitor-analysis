import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

export interface DeserializedPlatform {
  id: string
  code: string
  name: string
  logo?: string | null
  enabled?: boolean | null
}

/** 简单平台主键判断，兼容 Prisma 返回的完整对象或已摘字段对象。 */
function isPlatformRecord(row: unknown): row is DeserializedPlatform {
  const record = row as Record<string, unknown>
  return Boolean(record && typeof record.code === 'string' && typeof record.name === 'string')
}

/**
 * 共享平台数据（对照旧版 `hooks/usePlatforms`：拉 /api/platform/list → platformNames + platformLogoMap）。
 * 桌面端从后端 /api/platforms 读取，返回 platforms 数组及名称/logo 映射；后端不可用时返回空，不伪造。
 */
export function usePlatforms() {
  const [platforms, setPlatforms] = useState<DeserializedPlatform[]>([])

  useEffect(() => {
    let cancelled = false
    api
      .get<unknown[]>('/api/platforms')
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return
        setPlatforms(data.filter(isPlatformRecord))
      })
      .catch(() => {
        if (!cancelled) setPlatforms([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const controls = useMemo(() => {
    const platformNames: Record<string, string> = {}
    const platformLogoMap: Record<string, string> = {}
    for (const p of platforms) {
      platformNames[p.code] = p.name
      if (p.logo) platformLogoMap[p.code] = p.logo
    }
    return { platformNames, platformLogoMap }
  }, [platforms])

  return useMemo(
    () => ({ platforms, ...controls }),
    [platforms, controls],
  )
}