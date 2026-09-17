import { verifyGuidelines } from '../src/images/guidelines.manifest'

/**
 * 运行时资产生命线冒烟：校验图片工作流提示词 spec 是否齐全。
 * 缺失时非 0 退出，杜绝"静默走兜底口径"导致生成质量退化却无感知。
 */
const report = verifyGuidelines()

console.log('=== guidelines 资产校验 ===')
console.log(`主图 spec 目录: ${report.mainDir}`)
console.log(`详情 spec 目录: ${report.detailDir}`)
console.log(`主图缺失: ${report.mainMissing.length ? report.mainMissing.join(' , ') : '无'}`)
console.log(`详情缺失: ${report.detailMissing.length ? report.detailMissing.join(' , ') : '无'}`)
console.log(`结果: ${report.ok ? '✅ 通过' : '❌ 失败（存在缺失，生图会走兜底口径）'}`)

if (!report.ok) {
  console.error('guidelines-smoke FAILED: 可运行配置或文件路径异常，请检查 apps/guidelines 或 MAIN_IMAGE_SPEC_DIR/DETAIL_IMAGE_SPEC_DIR。')
  process.exit(1)
}