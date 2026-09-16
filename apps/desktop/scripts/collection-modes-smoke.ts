import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalClient } from '../src/main/local-db-core'
import { runLocalCollection } from '../src/main/collection-runner'

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const tmp = join(tmpdir(), `eca-collection-modes-${Date.now()}`)
  const dbUrl = `file:${join(tmp, 'modes.db')}`
  mkdirSync(join(tmp, 'work'), { recursive: true })

  execFileSync(process.execPath, [join(root, 'scripts/apply-local-migration.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DESKTOP_DB_URL: dbUrl },
  })
  const prisma = createLocalClient(dbUrl)

  const productFile = join(tmp, 'work/product.xlsx')
  const imageFile = join(tmp, 'work/product.png')
  writeFileSync(productFile, 'product-data')
  writeFileSync(imageFile, 'png-data')

  const fakeDownloader = async () => ({ files: [productFile, imageFile] })
  const fakeImporter = async (_ctx: unknown, files: string[]) => ({
    counts: { productCount: 2, skuCount: 1, fileCount: files.length },
    summary: 'cleaned from downloaded exports',
  })

  const downloadOnly = await runLocalCollection({
    db: prisma,
    jobId: 'job-download-only',
    mode: 'download-only',
    input: { productName: '测试商品' },
    workDir: join(tmp, 'work'),
    runDownload: fakeDownloader,
  })

  const downloadAndImport = await runLocalCollection({
    db: prisma,
    jobId: 'job-download-and-import',
    mode: 'download-and-import',
    input: { productName: '测试商品' },
    workDir: join(tmp, 'work'),
    runDownload: fakeDownloader,
    runImport: fakeImporter,
  })

  const importOnly = await runLocalCollection({
    db: prisma,
    jobId: 'job-import-only',
    mode: 'import-only',
    input: { existingFiles: [productFile] },
    workDir: join(tmp, 'work'),
    runDownload: async () => {
      throw new Error('import-only must not run download')
    },
    runImport: fakeImporter,
  })

  let invalidRejected = false
  try {
    await runLocalCollection({
      db: prisma,
      jobId: 'job-invalid',
      mode: 'import-then-do-nothing' as never,
      input: {},
      workDir: join(tmp, 'work'),
    })
  } catch {
    invalidRejected = true
  }

  const output = {
    downloadOnlyStages: downloadOnly.stages.map((stage) => stage.name).join(','),
    downloadAndImportStages: downloadAndImport.stages.map((stage) => stage.name).join(','),
    importOnlyStages: importOnly.stages.map((stage) => stage.name).join(','),
    downloadOnlyFiles: downloadOnly.files.length,
    downloadOnlyCounts: downloadOnly.counts,
    downloadAndImportCounts: downloadAndImport.counts,
    importOnlyCounts: importOnly.counts,
    invalidRejected,
  }
  console.log(JSON.stringify(output))

  await prisma.$disconnect()
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    output.downloadOnlyStages === 'download,collect-files,sync' &&
    output.downloadAndImportStages === 'download,collect-files,import,sync' &&
    output.importOnlyStages === 'collect-files,import,sync' &&
    output.downloadOnlyFiles === 2 &&
    Object.keys(output.downloadOnlyCounts).length === 0 &&
    output.downloadAndImportCounts.productCount === 2 &&
    output.downloadAndImportCounts.fileCount === 2 &&
    output.importOnlyCounts.productCount === 2 &&
    output.invalidRejected
  process.exit(ok ? 0 : 1)
}

void main()
