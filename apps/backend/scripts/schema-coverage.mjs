import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const schemaPath = resolve(new URL('..', import.meta.url).pathname, 'prisma/schema.prisma')
const schema = readFileSync(schemaPath, 'utf8')
const models = new Set([...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1]))

const expected = [
  'Tenant', 'Department', 'User', 'Role', 'Permission', 'UserRole', 'RolePermission', 'RoleStore',
  'Platform', 'Store', 'Job', 'JobEvent', 'CollectionJob', 'SourceFileRecord',
  'ProductSnapshot', 'ProductSkuSnapshot', 'ProductQaSnapshot', 'ProductReviewSnapshot',
  'AnalysisRun', 'AnalysisPriceBand', 'AnalysisBandProduct', 'AnalysisBandImage',
  'AnalysisProductAnalysis', 'AnalysisInsight', 'MainImageAnalysis', 'ListingDraft',
  'MediaAsset', 'GeneratedAsset', 'Agent', 'AgentAssignment', 'ReviewRecord',
  'AiUsageLog', 'AiCallCache', 'SystemConfig', 'ProviderProfile',
]

const missing = expected.filter((model) => !models.has(model))
for (const model of expected) {
  console.log(`${models.has(model) ? 'PASS' : 'FAIL'}  ${model}`)
}
console.log(`schema coverage: ${expected.length - missing.length}/${expected.length}`)
if (missing.length) {
  console.error(`missing models: ${missing.join(', ')}`)
  process.exit(1)
}
