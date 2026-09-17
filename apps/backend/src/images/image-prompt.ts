// 主图/详情图提示词生成（迁移自旧 `apps/legacy/src/server/mainImagePromptExpansion.js`）。
// 本模块只承载「规则常量 + 纯字符串生成的提示词模板」，不包含 AI 调用、不依赖真实模型 Key，
// 可独立单元测试。AI 编排（多阶段、重试、降级、落库）在镜像侧服务中承接（见 image-prompt.engine）。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface PromptSlot {
  id: string
  name: string
  type: string
  sequence: number
}

export interface PromptSettings {
  platform?: string
  country?: string
  language?: string
  ratio?: string
}

/** 主图默认 5 图位。 */
export const DEFAULT_SLOT_CONFIGS: PromptSlot[] = [
  { id: 'image-1', name: '图1｜白底图', type: '白底图', sequence: 1 },
  { id: 'image-2', name: '图2｜场景图', type: '场景图', sequence: 2 },
  { id: 'image-3', name: '图3｜卖点图', type: '卖点图', sequence: 3 },
  { id: 'image-4', name: '图4｜细节说明', type: '细节说明', sequence: 4 },
  { id: 'image-5', name: '图5｜卖点详解', type: '卖点详解', sequence: 5 },
]

/** 各主图位类型的内联规则（在 spec 文件缺失时兜底）。 */
export const IMAGE_PROMPT_TYPE_RULES: Record<string, string> = {
  白底图: '纯白或接近纯白背景，单一完整商品主体居中展示，主体清晰、边缘干净、光线柔和均匀；不得添加标题、卖点文案、图标、贴纸、促销角标、人物、道具、尺寸线、引线、局部放大窗或多图拼贴。',
  场景图: '生成一个完整真实的使用/佩戴/陈列场景，商品必须是第一视觉中心；场景服务于商品用途和风格，允许1个短标题和少量短标签；同批多张场景图必须在场景、人物姿势、镜头距离、光线氛围、标题和标签上明显不同。',
  卖点图: '只聚焦1个核心卖点，用商品局部、佩戴/使用效果、放大窗、对比区或视觉证据证明；标题短、标签少、层级清晰；同批多张卖点图必须分别讲不同卖点，不得复用同一主标题、卖点词或版式。',
  细节说明: '重点说明1个真实可见细节，或2到3个相互关联的真实细节、结构、尺寸关系、佩戴/使用方式；可使用局部放大、引线、尺寸线、参数卡片或说明小窗；只标注图片可见或用户明确提供的信息，不得编造参数、材质、结构、工艺或认证。',
  卖点详解: '围绕2到3个不同核心卖点做综合拆解，形成购买理由；可使用主体产品、场景小窗、局部小窗、参数卡片、图标标签或证据模块；不得只讲单一卖点，不得做成大段文字，不得虚构品牌、型号、功效、材质等级或具体数值。',
}

/** 主图 spec 文件名映射。 */
export const WORKFLOW_SPEC_FILES: Record<string, string> = {
  information: '生成信息整理补全.md',
  designPlan: '生成主图设计规划.md',
  白底图: '生成图1白底图提示词.md',
  场景图: '生成图2场景图提示词.md',
  卖点图: '生成图3卖点图提示词.md',
  细节说明: '生成图4细节说明图提示词.md',
  卖点详解: '生成图5卖点详解图提示词.md',
}

/** 详情图模块顺序（16 个）。 */
export const DETAIL_MODULE_ORDER = [
  '首屏主视觉',
  '核心卖点图',
  '使用场景图',
  '多角度图',
  '场景氛围图',
  '商品细节图',
  '品牌故事图',
  '尺寸/容量/尺码图',
  '效果对比图',
  '详细规格/参数表',
  '工艺制作图',
  '配件/赠品图',
  '系列展示图',
  '商品成分图',
  '售后保障图',
  '使用建议图',
]

/** 详情图 spec 文件名映射。 */
export const DETAIL_WORKFLOW_SPEC_FILES: Record<string, string> = {
  information: '生成信息整理补全.md',
  designPlan: '生成详情页设计规划.md',
  首屏主视觉: '生成「首屏主视觉」的生图提示词.md',
  核心卖点图: '生成「核心卖点图」的生图提示词.md',
  使用场景图: '生成「使用场景图」的生图提示词.md',
  多角度图: '生成「多角度图」的生图提示词.md',
  场景氛围图: '生成「场景氛围图」的生图提示词.md',
  商品细节图: '生成「商品细节图」的生图提示词.md',
  品牌故事图: '输出「品牌故事图」的生图提示词.md',
  '尺寸/容量/尺码图': '输出「尺寸_容量_尺码图」的生图提示词.md',
  效果对比图: '输出「效果对比图」的生图提示词.md',
  '详细规格/参数表': '输出「详细规格_参数表」的生图提示词.md',
  工艺制作图: '输出「工艺制作图」的生图提示词.md',
  '配件/赠品图': '输出「配件_赠品图」的生图提示词.md',
  系列展示图: '输出「系列展示图」的生图提示词.md',
  商品成分图: '输出「商品成分图」的生图提示词.md',
  售后保障图: '输出「售后保障图」的生图提示词.md',
  使用建议图: '输出「使用建议图」的生图提示词.md',
}

/** 默认 spec 目录（从仓库 guidelines 读取，可用 env 覆盖）。 */
export const MAIN_IMAGE_SPEC_DIR = process.env.MAIN_IMAGE_SPEC_DIR ?? join(dirname(process.cwd()), 'guidelines/main-image-workflow')
export const DETAIL_IMAGE_SPEC_DIR = process.env.DETAIL_IMAGE_SPEC_DIR ?? join(dirname(process.cwd()), 'guidelines/detail-workflow')

/** 记录已告警过的缺失 spec，避免重复刷屏。 */
const warnedMissing = new Set<string>()

/** 读取主图 spec 文件（缺失时返回空字符串，但会告警，杜绝静默兜底）。 */
export function readWorkflowSpec(key: string, specDir = MAIN_IMAGE_SPEC_DIR): string {
  const fileName = WORKFLOW_SPEC_FILES[key]
  if (!fileName) return ''
  const filePath = join(specDir, fileName)
  try {
    if (!existsSync(filePath)) {
      if (!warnedMissing.has(filePath)) {
        warnedMissing.add(filePath)
        console.warn(`[image-prompt] 主图 spec 缺失，将使用兜底口径: ${filePath}`)
      }
      return ''
    }
    return readFileSync(filePath, 'utf8').trim()
  } catch {
    return ''
  }
}

/** 读取详情图 spec 文件（缺失时返回空字符串，但会告警，杜绝静默兜底）。 */
export function readDetailWorkflowSpec(key: string, specDir = DETAIL_IMAGE_SPEC_DIR): string {
  const fileName = DETAIL_WORKFLOW_SPEC_FILES[key]
  if (!fileName) return ''
  const filePath = join(specDir, fileName)
  try {
    if (!existsSync(filePath)) {
      if (!warnedMissing.has(filePath)) {
        warnedMissing.add(filePath)
        console.warn(`[image-prompt] 详情图 spec 缺失，将使用兜底口径: ${filePath}`)
      }
      return ''
    }
    return readFileSync(filePath, 'utf8').trim()
  } catch {
    return ''
  }
}

/** 从模型文本提取 JSON 对象。 */
export function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** 归一化主图位类型。 */
export function normalizeImageType(type: string, index: number): string {
  const fallback = ['白底图', '场景图', '卖点图', '细节说明', '卖点详解']
  return String(type || fallback[index] || `图${index + 1}`).trim()
}

const MAIN_FALLBACK_TYPES = Object.keys(IMAGE_PROMPT_TYPE_RULES)

/** 归一化请求的主图位。 */
export function normalizeRequestedPromptSlots(promptSlots: unknown[]): PromptSlot[] {
  const allowedTypes = new Set(MAIN_FALLBACK_TYPES)
  return (Array.isArray(promptSlots) ? promptSlots : [])
    .map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>
      const type = String(record.type ?? '').trim()
      if (!allowedTypes.has(type)) return null
      const sequence = Number.isFinite(Number(record.sequence)) ? Number(record.sequence) : index + 1
      return {
        id: String(record.id ?? `image-prompt-${index + 1}`).trim(),
        name: String(record.name ?? `${String(sequence).padStart(2, '0')} ${type}`).trim(),
        type,
        sequence,
      } as PromptSlot
    })
    .filter((slot): slot is PromptSlot => slot !== null)
    .slice(0, 20)
}

/** 归一化模型返回的主图 prompt，对齐请求图位。 */
export function normalizeGeneratedImagePrompts(json: Record<string, unknown>, promptSlots: PromptSlot[]): Array<PromptSlot & { prompt: string }> {
  const rawPrompts = Array.isArray(json?.prompts) ? (json.prompts as Array<Record<string, unknown>>) : []
  const promptsById = new Map(rawPrompts.map((item) => [String(item?.id ?? '').trim(), item]))
  return promptSlots.map((slot, index) => {
    const raw = promptsById.get(slot.id) ?? rawPrompts[index] ?? {}
    return {
      id: slot.id,
      name: slot.name,
      type: slot.type,
      sequence: slot.sequence,
      prompt: String(raw.prompt ?? '').trim(),
    } as PromptSlot & { prompt: string }
  }).filter((item) => item.prompt)
}

/** 归一化详情图模块类型（容忍斜杠/下划线/空格差异）。 */
export function normalizeDetailModuleType(type: string): string {
  const cleanType = String(type ?? '').trim()
  if (DETAIL_MODULE_ORDER.includes(cleanType)) return cleanType
  const normalized = cleanType.replace(/[／]/g, '/').replace(/_/g, '/').replace(/\s+/g, '')
  return DETAIL_MODULE_ORDER.find((item) => item.replace(/\s+/g, '') === normalized) ?? ''
}

/** 归一化请求的详情图模块（按 DETAIL_MODULE_ORDER 顺序返回）。 */
export function normalizeDetailPromptSlots(promptSlots: unknown[]): PromptSlot[] {
  const allowedTypes = new Set(DETAIL_MODULE_ORDER)
  const seen = new Set<string>()
  const requested = (Array.isArray(promptSlots) ? promptSlots : [])
    .map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>
      const rawType = typeof item === 'string' ? item : record.type ?? record.name
      const type = normalizeDetailModuleType(String(rawType ?? ''))
      if (!allowedTypes.has(type) || seen.has(type)) return null
      seen.add(type)
      const sequence = Number.isFinite(Number(record.sequence)) ? Number(record.sequence) : index + 1
      return {
        id: String(record.id ?? `detail-${sequence}-${type}`).trim(),
        name: String(record.name ?? `${String(sequence).padStart(2, '0')} ${type}`).trim(),
        type,
        sequence,
      } as PromptSlot
    })
    .filter((slot): slot is PromptSlot => slot !== null)

  return DETAIL_MODULE_ORDER
    .map((type) => requested.find((slot) => slot.type === type))
    .filter((slot): slot is PromptSlot => Boolean(slot))
}

/** 只保留用户勾选的主图位（按默认顺序）。 */
export function normalizeSelectedSlots(selectedSlots: unknown[]): PromptSlot[] {
  const allowed = new Map(DEFAULT_SLOT_CONFIGS.map((item) => [item.id, item]))
  const selectedIds = new Set(
    (Array.isArray(selectedSlots) ? selectedSlots : [])
      .map((item) => (typeof item === 'string' ? item : (item as Record<string, unknown>).id))
      .map((id) => String(id ?? '').trim())
      .filter((id) => allowed.has(id)),
  )
  return DEFAULT_SLOT_CONFIGS.filter((item) => selectedIds.has(item.id))
}
// ---- 主图工作流提示词模板（纯字符串拼接，不调 AI） ----

/** 主图工作流第2步：信息整理补全。 */
export function buildWorkflowInformationPrompt(options: { settings?: PromptSettings; baseText?: string; reportText?: string }, specDir = MAIN_IMAGE_SPEC_DIR): string {
  const spec = readWorkflowSpec('information', specDir)
  return `你正在执行商品主图生图工作流第2步：生成“信息整理补全”。

【生成规范】
${spec || '整理产品名称、品类、核心卖点、可见特征、适用人群、适用场景、具体参数、平台/地区和合规边界；不得编造不可见或未提供的信息。'}

【用户输入】
用户填写商品信息：${String(options.baseText ?? '').trim() || '用户未填写'}
引用AI报告内容：${String(options.reportText ?? '').trim() || '用户未引用AI报告'}
目标平台：${options.settings?.platform || '未设置'}
销售地区：${options.settings?.country || '未设置'}
画面语种：${options.settings?.language || '简体中文'}
输出比例：${options.settings?.ratio || '1:1'}

【输出要求】
必须只输出 JSON，不要使用 Markdown，不要输出分析过程。
{
  "information": "按规范生成的信息整理补全文本"
}`
}

/** 主图工作流第3步：主图设计规划。 */
export function buildWorkflowDesignPlanPrompt(options: { settings?: PromptSettings; information?: string; promptSlots: PromptSlot[] }, specDir = MAIN_IMAGE_SPEC_DIR): string {
  const spec = readWorkflowSpec('designPlan', specDir)
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  return `你正在执行商品主图生图工作流第3步：生成“主图设计规划”。

【生成规范】
${spec || '按每个图位输出实际图位类型、核心视觉、展示视角、背景/风格、人物/道具建议、平台要求、品类策略、版式/文字排版、画面文案。'}

【信息整理补全】
${String(options.information ?? '').trim()}

【页面设置】
目标平台：${options.settings?.platform || '未设置'}
销售地区：${options.settings?.country || '未设置'}
画面语种：${options.settings?.language || '简体中文'}
输出比例：${options.settings?.ratio || '1:1'}

【本次需要规划的图位】
${slotList}

【执行口径】
1. 生成规范中的“按5个图位”是默认套图结构；如果本次图位数量、类型或顺序与默认结构不同，必须以“本次需要规划的图位”为准。
2. 同一种图位出现多张时，每张都必须单独规划，并明确区分卖点、场景、视角、构图和画面文案。
3. 不要把示例商品、上一批商品或未在信息整理补全中出现的造型、颜色、材质、纹理、场景带入本次规划。

【输出要求】
1. 只规划本次需要的图位，数量和顺序必须一致。
2. 每张图一行，字段完整，不要互相重复卖点、场景、文案和视角。
3. 直接输出主图设计规划正文，不要输出 JSON，不要使用 Markdown，不要输出分析过程。`
}

/** 主图工作流第4步：生成各图位完整生图提示词。 */
export function buildImagePromptGenerationPrompt(options: { settings?: PromptSettings; information?: string; designPlan?: string; promptSlots: PromptSlot[] }, specDir = MAIN_IMAGE_SPEC_DIR): string {
  const schema = options.promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整图生图提示词',
  }))
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = options.promptSlots.map((slot) => {
    const spec = readWorkflowSpec(slot.type, specDir)
    return `【${slot.name}｜${slot.type}】\n${spec || IMAGE_PROMPT_TYPE_RULES[slot.type] || ''}`
  }).join('\n\n')

  return `你正在执行商品主图生图工作流第4步：根据主图设计规划生成各图位完整生图提示词。

【信息整理补全】
${String(options.information ?? '').trim() || '以用户上传商品图中的可见信息为准'}

【主图设计规划】
${String(options.designPlan ?? '').trim()}

【页面设置】
目标平台：${options.settings?.platform || '电商平台'}
销售地区：${options.settings?.country || '未设置'}
页面语言：${options.settings?.language || '简体中文'}
输出比例：${options.settings?.ratio || '1:1'}

【需要生成的图位】
${slotList}

【各类型规则】
${typeRules}

【总规则】
1. 只为“需要生成的图位”输出 prompts，数量和顺序必须完全一致。
2. 每条 prompt 都必须严格基于对应图位的“主图设计规划”和该图位 md 规范生成，不得只套用通用短规则。
3. 必须以用户上传的商品图为唯一商品主体，保持商品外观、颜色、结构、比例、关键部件、包装文字和可见特征一致，不替换商品，不生成其他品类。
4. 所有颜色、材质、结构、花型、纹理、参数、场景和文案都只能来自商品图片、商品信息或保守可确认的品类常识；不得把示例商品、上一批商品或其他商品的蝴蝶造型、蓝白配色、大理石纹路等带入当前商品。
5. 同类型多张图必须各自有不同主题：场景图区分使用场景、人物姿势、镜头距离和光线；卖点图区分核心卖点；卖点详解图区分购买理由组合；细节说明图区分真实细节对象。
6. 每条 prompt 写成中文自然段，包含图位目标、主体要求、背景/场景、构图、光影、配色、文字版式、禁止事项，长度300-600字。
7. 文案必须短、清楚、适合${options.settings?.language || '简体中文'}，不得输出无法读清的小字、错字、无关品牌、水印、UI按钮或促销角标。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释或分析过程。
{
  "prompts": ${JSON.stringify(schema, null, 2)}
}`
}

// ---- 详情图工作流提示词模板 ----

/** 详情图工作流第2步：信息整理补全。 */
export function buildDetailWorkflowInformationPrompt(options: { settings?: PromptSettings; baseText?: string; reportText?: string }, specDir = DETAIL_IMAGE_SPEC_DIR): string {
  const spec = readDetailWorkflowSpec('information', specDir)
  return `你正在执行商品详情图生成工作流第2步：信息整理补全。

【生成规范：生成信息整理补全.md】
${spec || '只整理产品事实信息，包含商品核心、平台、语种、画面参考风格、动作/道具建议、合规边界/信息缺口；不得编造不可见参数。'}

【输入】
用户上传商品图：已随消息提供
用户填写商品信息：${String(options.baseText ?? '').trim() || '用户未填写'}
引用AI报告分析结论：${String(options.reportText ?? '').trim() || '用户未引用AI报告'}
目标平台：${options.settings?.platform || '国内电商平台'}
销售地区：${options.settings?.country || '中国'}
画面语种：${options.settings?.language || '中文'}
输出比例：${options.settings?.ratio || '1:1'}

【输出要求】
1. 严格按规范输出“信息整理补全”正文。
2. 不生成详情页，不规划模块，不生成生图提示词。
3. 不输出分析过程、前言、结语或对话说明。`
}

/** 详情图工作流第3步：详情页设计规划。 */
export function buildDetailWorkflowDesignPlanPrompt(options: { settings?: PromptSettings; information?: string; promptSlots: PromptSlot[] }, specDir = DETAIL_IMAGE_SPEC_DIR): string {
  const spec = readDetailWorkflowSpec('designPlan', specDir)
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.type}`).join('\n')
  return `你正在执行商品详情图生成工作流第3步：详情页设计规划。

【生成规范：生成详情页设计规划.md】
${spec || '输出详情页总规划和已勾选模块规划，每行字段用｜连接。'}

【信息整理补全】
${String(options.information ?? '').trim()}

【页面设置】
目标平台：${options.settings?.platform || '国内电商平台'}
销售地区：${options.settings?.country || '中国'}
画面语种：${options.settings?.language || '中文'}
输出比例：${options.settings?.ratio || '1:1'}

【本次勾选模块】
${slotList}

【执行口径】
1. 详情页模块由外部勾选决定，只输出“本次勾选模块”。
2. 必须按“本次勾选模块”的顺序输出，未勾选模块不得出现。
3. 已勾选模块不得删除、合并、改名或自行调整顺序。
4. 每个模块必须包含主标题、副标题、画面策略、人物/道具建议、图位文案、协同要求。

【输出要求】
直接输出设计规划正文，不要 JSON，不要 Markdown 代码块，不要分析过程。`
}

/** 详情图工作流第4步：根据设计规划生成各模块完整生图提示词。 */
export function buildDetailImagePromptGenerationPrompt(options: { settings?: PromptSettings; information?: string; designPlan?: string; promptSlots: PromptSlot[] }, specDir = DETAIL_IMAGE_SPEC_DIR): string {
  const schema = options.promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整详情图生图提示词',
  }))
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = options.promptSlots.map((slot) => {
    const spec = readDetailWorkflowSpec(slot.type, specDir)
    return `【${slot.name}｜${slot.type}】\n${spec || '按该详情图模块规划输出一段可直接用于生图的最终提示词。'}`
  }).join('\n\n')

  return `你正在执行商品详情图生成工作流第4步：根据详情页设计规划生成各模块完整生图提示词。

【信息整理补全】
${String(options.information ?? '').trim()}

【详情页设计规划】
${String(options.designPlan ?? '').trim()}

【页面设置】
目标平台：${options.settings?.platform || '电商平台'}
销售地区：${options.settings?.country || '中国'}
画面语种：${options.settings?.language || '中文'}
输出比例：${options.settings?.ratio || '1:1'}

【需要生成提示词的模块】
${slotList}

【各模块生图提示词规范】
${typeRules}

【总规则】
1. 只输出“需要生成提示词的模块”，数量、id、name、type 必须与输入完全一致。
2. 每个 prompt 必须基于《信息整理补全》、对应模块的《详情页设计规划》和该模块 md 规范生成。
3. 每个 prompt 必须明确：商品必须严格参考用户上传产品图，保持颜色、材质、结构比例、纹理、轮廓、包装/标签和关键设计特征一致。
4. 每个 prompt 必须包含该模块规范要求保留的字段结构，例如[第1屏]、[氛围/风格]、[元素布局]、[光影质感]、[配色色系]、[视角构图]、[文字版式]、[比例分辨率]。
5. 同一套详情图必须保持统一全局视觉系统，但不同模块不得重复同一构图、同一角度、同一文案或同一利益点。
6. 画面文字必须短、清楚、移动端可读，并严格使用页面语种。
7. 不得编造价格、折扣、赠品、认证、检测报告、销量、平台背书、绝对化表达、联系方式、二维码、水印或其他品牌标识。
8. 每条 prompt 输出为中文自然段，约400字以上，可直接用于图生图。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释或分析过程。
{
  "prompts": ${JSON.stringify(schema, null, 2)}
}`
}

// ---- AI 改图（retouch）提示词 ----

export const RETOUCH_INTENTS = ['retouch', 'style_scene', 'product_fix', 'text_edit'] as const
export type RetouchIntent = (typeof RETOUCH_INTENTS)[number]

export interface RetouchSlot {
  name?: string
  type?: string
}

/** 归一化改图 intent。 */
export function normalizeRetouchIntent(value: string): RetouchIntent {
  const intent = String(value ?? '').trim()
  return (RETOUCH_INTENTS as readonly string[]).includes(intent) ? (intent as RetouchIntent) : 'retouch'
}

/** 归一化改图参考模式。 */
export function normalizeRetouchReferenceMode(value: string, intent: RetouchIntent): 'current_only' | 'product_and_current' {
  const mode = String(value ?? '').trim()
  if (mode === 'current_only' || mode === 'product_and_current') return mode
  return intent === 'retouch' || intent === 'text_edit' ? 'current_only' : 'product_and_current'
}

/** 生成 AI 改图专用提示词（含参考图优先级规则）。 */
export function buildImageRetouchPromptGenerationPrompt(options: { settings?: PromptSettings; slot?: RetouchSlot; originalPrompt?: string; userDirection?: string }): string {
  const cleanDirection = String(options.userDirection ?? '').trim() || '在保持当前画面风格、商品主体、文字和版式基本不变的前提下，轻微优化画面质感和电商展示效果。'
  return `你正在为电商商品图生成一条“AI改图专用提示词”。

【参考图说明】
参考图1：用户上传的商品原图，是商品结构、颜色、材质、比例、佩戴关系和关键细节的最高事实依据。
参考图2：当前已生成图片，是版式、构图、背景、文案位置、光影氛围和画面风格参考。

【当前图位信息】
图位名称：${options.slot?.name || '未命名图位'}
图位类型：${options.slot?.type || '商品图'}
原始生图提示词：
${String(options.originalPrompt ?? '').trim() || '未提供'}

【用户修改要求】
${cleanDirection}

【任务】
1. 先判断用户修改意图，只能选择一个 intent：
   - retouch：轻微优化画质、光影、质感、清晰度、干净度，不改变画面核心内容。
   - style_scene：调整风格、背景、场景、氛围、模特姿态或视觉调性。
   - product_fix：修正商品结构、外观、材质、颜色、比例、错位、变形、商品不像原图等问题。
   - text_edit：主要是修改、删除或替换画面文字。
2. 根据 intent 生成一条完整改图提示词。
3. 改图提示词必须说明参考图优先级：
   - product_fix：商品结构必须严格以参考图1为准；参考图2只保留版式、背景、文案和风格。
   - style_scene：商品必须以参考图1为准；参考图2保留图位类型、主体大小、文字层级和商业版式，可按用户要求调整场景/风格。
   - retouch：以参考图2为主，仅轻微优化；参考图1用于校验商品不要漂移。
   - text_edit：以参考图2为主，只改文字区域；不要改变商品和背景。
4. 如果用户指出商品错位或结构错误，必须在提示词中明确“修正错误关系”，不能继续沿用当前生成图里的错误结构。
5. 不得重新规划整套图片，不得新增无关卖点、品牌、参数、材质、纹理或促销信息。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释。
{
  "intent": "retouch | style_scene | product_fix | text_edit",
  "referenceMode": "current_only | product_and_current",
  "prompt": "完整 AI 改图提示词"
}`
}

/** 生成改图回退提示词（纯文本，不依赖模型 JSON 解析）。 */
export function buildFallbackRetouchPrompt(options: { settings?: PromptSettings; slot?: RetouchSlot; originalPrompt?: string; userDirection?: string }): string {
  const direction = String(options.userDirection ?? '').trim() || '轻微优化画面质感和电商展示效果'
  return [
    '基于参考图进行电商图片定向改图。',
    '参考图1为用户上传商品原图，商品结构、颜色、材质、比例、佩戴关系和关键细节必须以参考图1为最高依据。',
    '参考图2为当前生成图，只用于保留图位类型、构图、版式、文案位置、背景方向和整体商业风格。',
    `当前图位：${options.slot?.name || ''} ${options.slot?.type || '商品图'}`.trim(),
    `用户修改要求：${direction}`,
    `原始生图提示词：${String(options.originalPrompt ?? '').trim() || '未提供'}`,
    `输出比例：${options.settings?.ratio || '1:1'}；画面语种：${options.settings?.language || '中文'}。`,
    '只修改用户明确指出的问题，其他部分保持稳定；不得新增无关文字、品牌、水印、促销角标、虚构参数、虚构材质或不存在的商品结构。',
  ].join('\n')
}
