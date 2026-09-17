import { Injectable, OnModuleInit } from '@nestjs/common'
import { verifyGuidelines } from './guidelines.manifest'

/**
 * 运行时资产启动自检：
 * - IMAGE_SPEC_STRICT=1 时，guidelines spec 缺失 → 启动即抛错（fail-fast，杜绝静默兜底）。
 * - 默认（非严格）时，启动打一条 warn 暴露资产状态，让"可能走兜底口径"可见。
 */
@Injectable()
export class GuidelinesStartupCheck implements OnModuleInit {
  onModuleInit() {
    const report = verifyGuidelines()
    const strict = process.env.IMAGE_SPEC_STRICT === '1'
    if (!report.ok && strict) {
      throw new Error(
        `IMAGE_SPEC_STRICT 已启用但 guidelines 资产缺失：主图 spec 缺 ${report.mainMissing.length} 项、详情 spec 缺 ${report.detailMissing.length} 项。` +
          `请检查 ${report.mainDir} / ${report.detailDir} 或设置 MAIN_IMAGE_SPEC_DIR / DETAIL_IMAGE_SPEC_DIR。`,
      )
    }
    if (!report.ok) {
      console.warn(
        `[guidelines] 资产缺失（严格模式未开启，生图将走兜底口径）：主图 spec 缺 ${report.mainMissing.length} 项、详情 spec 缺 ${report.detailMissing.length} 项。`,
      )
      return
    }
    console.log(`[guidelines] 资产就绪：主图 ${report.mainDir}、详情 ${report.detailDir}`)
  }
}