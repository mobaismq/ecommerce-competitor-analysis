import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

const MAPPING: Array<[string, string[]]> = [
  ['sys_user', ['User']],
  ['sys_dept', ['Department']],
  ['sys_role', ['Role', 'UserRole', 'RolePermission']],
  ['sys_menu/sys_button', ['Permission']],
  ['sys_platform', ['Platform']],
  ['sys_store', ['Store']],
  ['crawl_job', ['CollectionJob', 'Job']],
  ['source_file_record', ['SourceFileRecord']],
  ['product_snapshot', ['ProductSnapshot']],
  ['product_sku_snapshot', ['ProductSkuSnapshot']],
  ['product_qa_snapshot', ['ProductQaSnapshot']],
  ['product_review_snapshot', ['ProductReviewSnapshot']],
  ['market_analysis_run', ['AnalysisRun']],
  ['market_price_band_*', ['AnalysisPriceBand', 'AnalysisBandProduct', 'AnalysisBandImage']],
  ['market_price_band_product_analysis', ['AnalysisProductAnalysis']],
  ['product_main_image_analysis', ['MainImageAnalysis']],
  ['market_main_image_ai_report', ['AiCallCache']],
  ['media_asset', ['MediaAsset']],
  ['market_product_asset/generated_main_image', ['GeneratedAsset']],
  ['market_listing_generation', ['ListingDraft']],
  ['rpa_tasks', ['Agent', 'AgentAssignment']],
]

const LEGACY_TABLE_NAMES = [
  'sys_user',
  'sys_dept',
  'sys_role',
  'sys_menu',
  'sys_button',
  'sys_platform',
  'sys_store',
  'crawl_job',
  'source_file_record',
  'product_snapshot',
  'market_analysis_run',
  'market_price_band',
  'generated_main_image',
  'media_asset',
  'rpa_tasks',
  'market_listing_generation',
]

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js')))
    .map((entry) => join(entry.parentPath, entry.name))
}

async function main() {
  const schema = readFileSync(join(backendRoot, 'prisma/schema.prisma'), 'utf8')
  const models = new Set([...schema.matchAll(/^model (\w+)/gm)].map((match) => match[1]))
  const missingModels: string[] = []
  for (const [, targets] of MAPPING) {
    for (const target of targets) if (!models.has(target)) missingModels.push(target)
  }

  const backendSources = walk(join(backendRoot, 'src'))
  const legacyRefs = LEGACY_TABLE_NAMES.filter((name) => backendSources.some((file) => readFileSync(file, 'utf8').includes(name)))

  const output = {
    mappings: MAPPING.length,
    modelCount: models.size,
    missingModels,
    legacyTableRefsInBackend: legacyRefs,
    backendSourceCount: backendSources.length,
  }
  console.log(JSON.stringify(output))
  const ok = missingModels.length === 0 && legacyRefs.length === 0
  process.exit(ok ? 0 : 1)
}

void main()
