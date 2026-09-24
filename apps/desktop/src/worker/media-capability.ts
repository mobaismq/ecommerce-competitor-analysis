import { getWorkerPrisma, readBytesByKey, removeBytes, storageKeyToLocalPath, workerDataRoots } from './worker-db'

/** 视频/媒体资产来源类型（对齐后端 mediaAsset 表 sourceType）。 */
const MEDIA_SOURCE_TYPES = ['video_source', 'video_replication'] as const

export interface MediaRecord {
  id: string
  storageKey: string
  mimeType: string
  size: number
  sourceUrl?: string | null
  originalName?: string | null
  createdAt?: string
}

export interface ListMediaInput {
  tenantId: string
}

export async function listMedia({ tenantId }: ListMediaInput): Promise<MediaRecord[]> {
  const db = getWorkerPrisma()
  const rows = await db.mediaAsset.findMany({
    where: {
      tenantId,
      sourceType: { in: [...MEDIA_SOURCE_TYPES] },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map((row) => ({
    id: row.id,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    size: row.size,
    sourceUrl: row.sourceUrl,
    originalName: row.originalName,
    createdAt: row.createdAt?.toISOString(),
  }))
}

export interface MediaRawInput {
  id: string
  tenantId: string
}

/** 读取媒体真实字节为 dataUrl；素材不存在返回 null。 */
export async function mediaRaw({ id, tenantId }: MediaRawInput): Promise<{ mimeType: string; dataUrl: string } | null> {
  const db = getWorkerPrisma()
  const asset = await db.mediaAsset.findFirst({ where: { id, tenantId } })
  if (!asset) return null
  const bytes = readBytesByKey(asset.storageKey, workerDataRoots())
  if (!bytes) return null
  const mimeType = asset.mimeType || 'video/mp4'
  return { mimeType, dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}` }
}

export interface DeleteMediaInput {
  id: string
  tenantId: string
}

export async function deleteMedia({ id, tenantId }: DeleteMediaInput): Promise<{ ok: boolean }> {
  const db = getWorkerPrisma()
  const asset = await db.mediaAsset.findFirst({ where: { id, tenantId } })
  if (!asset) return { ok: false }
  const roots = workerDataRoots()
  removeBytes(storageKeyToLocalPath(asset.storageKey, roots))
  await db.mediaAsset.delete({ where: { id } })
  return { ok: true }
}

export interface ReplicateVideoInput {
  tenantId: string
  sourceUrl?: string
  sourceStorageKey?: string
  title?: string
}

/**
 * 视频复刻能力。桌面端默认没有 VIDEO_PROVIDER 配置，诚实回落：
 * 绝不伪造假 mp4，也不调用真实外部服务；明确抛出"未接入"错误。
 */
export async function replicateVideo(_input: ReplicateVideoInput): Promise<never> {
  throw new Error('视频生成服务「视频复刻」未接入，请在 VIDEO_PROVIDER 配置真实服务或使用 mock')
}
