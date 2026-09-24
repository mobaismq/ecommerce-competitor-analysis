import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getWorkerPrisma, putBytes, workerDataRoots } from './worker-db'
import { deleteAsset, listAssets, rawAsset } from './asset-capability'

const dirs: string[] = []
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'asset-cap-'))
  dirs.push(root)
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterEach(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('asset capabilities', () => {
  it('list → raw → delete round trip using local readBytes', async () => {
    const db = getWorkerPrisma()
    const roots = workerDataRoots()
    const storageKey = `users/u1/product-sets/j1/image-1.png`
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    putBytes(storageKey, png, { userRoot: roots.userRoot })
    const asset = await db.generatedAsset.create({ data: { id: 'a1', tenantId: 't', jobId: 'j1', storageKey, mimeType: 'image/png', size: png.length, sourceUrl: null } })

    const list = await listAssets()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('a1')

    const raw = await rawAsset(asset.id)
    expect(raw.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(raw.size).toBe(png.length)

    const del = await deleteAsset(asset.id)
    expect(del.deleted).toBe(true)
    expect(await listAssets()).toHaveLength(0)
  })
})
