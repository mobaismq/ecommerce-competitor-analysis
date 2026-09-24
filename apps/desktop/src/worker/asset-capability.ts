import { getWorkerPrisma, readBytesByKey, workerDataRoots } from './worker-db'

export interface AssetRecord {
  id: string
  storageKey: string
  mimeType: string
  size: number
  runId: string | null
  jobId?: string | null
  sourceUrl?: string | null
  originalName?: string | null
  category?: string | null
  prompt?: string | null
  ratio?: string | null
  productName?: string | null
  productId?: string | null
  createdBy?: string | null
  platform?: string | null
  createdAt?: string
}

export async function listAssets(tenantId?: string, jobId?: string): Promise<AssetRecord[]> {
  const db = getWorkerPrisma()
  // 本地单机数据即本人资产：不按 tenant 过滤（本地库无多租户隔离意义），可按 jobId 细查。
  const rows = await db.generatedAsset.findMany({
    where: jobId ? { jobId } : {},
    orderBy: [{ createdAt: 'desc' }, { storageKey: 'asc' }],
    take: 500,
  })
  return rows.map((row) => ({
    id: row.id,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    size: row.size,
    runId: row.runId,
    jobId: row.jobId,
    sourceUrl: row.sourceUrl,
    originalName: row.originalName,
    category: row.category,
    prompt: row.prompt,
    ratio: row.ratio,
    productName: row.productName,
    productId: row.productId,
    createdBy: row.createdBy,
    platform: row.platform,
    createdAt: row.createdAt?.toISOString(),
  }))
}

export async function rawAsset(id: string): Promise<{ dataUrl: string; mimeType: string; size: number }> {
  const db = getWorkerPrisma()
  const asset = await db.generatedAsset.findUnique({ where: { id } })
  if (!asset) throw new Error('图片资产不存在')
  const bytes = readBytesByKey(asset.storageKey, workerDataRoots())
  if (!bytes) throw new Error('图片未落盘，无法读取真实字节')
  const mimeType = asset.mimeType || 'image/png'
  return { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`, mimeType, size: bytes.length }
}

export async function deleteAsset(id: string): Promise<{ deleted: boolean }> {
  const db = getWorkerPrisma()
  const asset = await db.generatedAsset.findUnique({ where: { id } })
  if (!asset) return { deleted: false }
  await db.generatedAsset.delete({ where: { id } })
  return { deleted: true }
}
