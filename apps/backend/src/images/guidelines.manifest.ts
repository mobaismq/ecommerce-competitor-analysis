import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  DETAIL_WORKFLOW_SPEC_FILES,
  DETAIL_IMAGE_SPEC_DIR,
  MAIN_IMAGE_SPEC_DIR,
  WORKFLOW_SPEC_FILES,
} from './image-prompt'

/**
 * 运行时必读资产清单：集中化声明 + fail-fast 校验。
 * 目的：把"应用运行时要读哪些非代码文件"（此处为图片工作流提示词 spec）显式收口，
 * 启动/冒烟时校验齐全；缺失时给出明确报错，而不是静默走兜底口径。
 */
export interface GuidelinesManifest {
  mainDir: string
  detailDir: string
  /** 主图工作流必读 spec（来自 WORKFLOW_SPEC_FILES） */
  mainFiles: string[]
  /** 详情图工作流必读 spec（来自 DETAIL_WORKFLOW_SPEC_FILES） */
  detailFiles: string[]
}

export interface VerifyReport {
  ok: boolean
  mainDir: string
  detailDir: string
  mainMissing: string[]
  detailMissing: string[]
}

function specDirMissing(dir: string): boolean {
  return !dir || !existsSync(dir)
}

/** 清单：为 image-prompt 声明的所有 spec key 解析出必读文件名。 */
export function buildGuidelinesManifest(): GuidelinesManifest {
  return {
    mainDir: MAIN_IMAGE_SPEC_DIR,
    detailDir: DETAIL_IMAGE_SPEC_DIR,
    mainFiles: Object.values(WORKFLOW_SPEC_FILES),
    detailFiles: Object.values(DETAIL_WORKFLOW_SPEC_FILES),
  }
}

/** 校验：逐个检查必读 spec 是否存在于解析目录。 */
export function verifyGuidelines(): VerifyReport {
  const m = buildGuidelinesManifest()
  const mainMissing = m.mainFiles.filter((f) => !existsSync(join(m.mainDir, f)))
  const detailMissing = m.detailFiles.filter((f) => !existsSync(join(m.detailDir, f)))
  return {
    ok: !specDirMissing(m.mainDir) && !specDirMissing(m.detailDir) && mainMissing.length === 0 && detailMissing.length === 0,
    mainDir: m.mainDir,
    detailDir: m.detailDir,
    mainMissing,
    detailMissing,
  }
}