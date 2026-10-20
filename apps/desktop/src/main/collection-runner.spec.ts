import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getWorkerPrisma } from '../worker/worker-db'
import { creativeFixture } from '../worker/test-fixtures/creative'
import { REPORT_SECTION_TITLES } from '../shared/report-skill'
import { generateReport, priceBandsPreview } from '../worker/report-capability'
import { buildDownloadArgs, defaultDownloader, runLocalCollection } from './collection-runner'
import { runPythonTracked } from './python-runner'

vi.mock('./python-runner', () => ({ runPythonTracked: vi.fn(), runPython: vi.fn() }))
const root = mkdtempSync(join(tmpdir(), 'collection-pipeline-test-'))
const originalRoot = process.env.ECOMMERCE_DATA_ROOT
let db: ReturnType<typeof getWorkerPrisma>

beforeAll(() => {
  process.env.ECOMMERCE_DATA_ROOT = root
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { stdio: 'pipe' })
  db = getWorkerPrisma()
})
afterAll(async () => {
  await db?.$disconnect()
  if (originalRoot === undefined) delete process.env.ECOMMERCE_DATA_ROOT
  else process.env.ECOMMERCE_DATA_ROOT = originalRoot
  rmSync(root, { recursive: true, force: true })
})

describe('desktop collection pipeline', () => {
  it('forwards quantity, page depth, zero minimum price and paths without shell interpolation', () => {
    expect(buildDownloadArgs({ jobId: 'test', mode: 'download-and-import', workDir: '/tmp/test dir', input: {
      productName: '测试 商品', params: { topN: 3, searchPages: 2, minPrice: 0, maxPrice: 50, speedProfile: 'balanced' },
    } })).toEqual(['--product-name', '测试 商品', '--run-dir', '/tmp/test dir', '--top-n', '3', '--search-pages', '2', '--min-price', '0', '--max-price', '50', '--speed-profile', 'balanced'])
  })

  it('streams progress, imports structured exports and makes them readable by reports', async () => {
    const workDir = join(root, 'collected')
    mkdirSync(workDir)
    const exportFile = join(workDir, 'product.xlsx')
    writeFileSync(exportFile, 'offline test fixture')
    const payload = { ok: true, files: [exportFile], products: [{ externalProductId: 'fixture-p1', title: '合成测试耳机',
      price: 59, sold: 100, salesAmount: 5900, shopName: '测试店铺', skus: [{ skuId: 'fixture-s1', name: '测试规格', price: 59 }],
      qas: [{ question: '支持什么接口？', answer: '测试回答' }], reviews: [{ content: '测试评价，质量好' }],
      sourceData: { exportDirectory: workDir, images: { detail_image_mode: 'detail_long_image' } },
    }] }
    vi.mocked(runPythonTracked).mockImplementationOnce(async (_script, _args, options) => {
      options?.onStdout?.('=== batch item 1/1\n真实进度格式\n')
      options?.onStdout?.(JSON.stringify(payload) + '\n')
      return { exitCode: 0, stdout: `=== batch item 1/1\n${JSON.stringify(payload)}\n`, stderr: '' }
    })
    const result = await runLocalCollection({ db, jobId: 'fixture-collected', mode: 'download-and-import', workDir,
      input: { productName: '测试耳机', downloadScript: '/fixture/bridge.py' } })
    expect(result.counts).toEqual({ productCount: 1, skuCount: 1, qaCount: 1, reviewCount: 1 })
    const log = readFileSync(join(workDir, 'run.log'), 'utf8')
    expect(log).toContain('=== local import')
    expect(log).not.toContain('fixture-p1')
    const preview = await priceBandsPreview({ tenantId: 'local', keyword: '测试耳机' })
    expect(preview.priceBands[0]).toMatchObject({ productCount: 1, soldTotal: 100 })
    const report = await generateReport({ userId: 'test-user', tenantId: 'local', keyword: '测试耳机' }, {
      generateText: async () => ({ text: JSON.stringify({ ...creativeFixture(), summary: '离线测试结果', markdown: REPORT_SECTION_TITLES.map((title) => `## ${title}\n信息不足`).join('\n\n'), reviewAnalysis: [{ reviewId: 'review-0', sentiment: 'positive', quote: '性价比', point: '价格' }] }), model: 'offline-test' }),
      analyzeImage: async () => { throw new Error('No image request expected') },
    })
    expect(report.competitorCount).toBe(1)
    expect(await db.productQaSnapshot.count()).toBe(1)
    expect(await db.productReviewSnapshot.count()).toBe(1)
    const snapshot = await db.productSnapshot.findFirst({ where: { externalProductId: 'fixture-p1' } })
    expect(snapshot?.rawJson).toMatchObject({ sourceData: { images: { detail_image_mode: 'detail_long_image' } } })
  })

  it('does not report success when the scraper returns no files', async () => {
    vi.mocked(runPythonTracked).mockResolvedValueOnce({ exitCode: 0, stdout: '{"ok":true,"files":[]}', stderr: '' })
    await expect(defaultDownloader({ jobId: 'empty', mode: 'download-and-import', workDir: root,
      input: { productName: '测试', downloadScript: '/fixture.py' } })).rejects.toThrow('did not report any files')
  })

  it('preserves cancellation and never imports a cancelled download', async () => {
    const result = runLocalCollection({ db, jobId: 'cancelled-fixture', mode: 'download-and-import', workDir: root, input: { productName: '测试' },
      runDownload: async () => {
        await db.localJob.update({ where: { jobId: 'cancelled-fixture' }, data: { status: 'cancelled' } })
        return { files: [], products: [{ externalProductId: 'never-import-this' }] }
      },
    })
    await expect(result).rejects.toThrow('用户已停止')
    expect((await db.localJob.findUnique({ where: { jobId: 'cancelled-fixture' } }))?.status).toBe('cancelled')
    expect(await db.productSnapshot.count({ where: { externalProductId: 'never-import-this' } })).toBe(0)
  })
})
