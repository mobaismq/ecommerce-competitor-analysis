// 主图提示词生成（自后端 images/image-prompt.ts 迁入，去依赖、去 spec 文件读取，保留规则常量与纯函数）。
// 桌面端不打包 guidelines 目录，故各类型规则直接采用内联口径（与后端缺失 spec 时的兜底一致）。

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

export const IMAGE_PROMPT_TYPE_RULES: Record<string, string> = {
  白底图: '纯白或接近纯白背景，单一完整商品主体居中展示，主体清晰、边缘干净、光线柔和均匀；不得添加标题、卖点文案、图标、贴纸、促销角标、人物、道具、尺寸线、引线、局部放大窗或多图拼贴。',
  场景图: '生成一个完整真实的使用/佩戴/陈列场景，商品必须是第一视觉中心；场景服务于商品用途和风格，允许1个短标题和少量短标签；同批多张场景图必须在场景、人物姿势、镜头距离、光线氛围、标题和标签上明显不同。',
  卖点图: '只聚焦1个核心卖点，用商品局部、佩戴/使用效果、放大窗、对比区或视觉证据证明；标题短、标签少、层级清晰；同批多张卖点图必须分别讲不同卖点，不得复用同一主标题、卖点词或版式。',
  细节说明: '重点说明1个真实可见细节，或2到3个相互关联的真实细节、结构、尺寸关系、佩戴/使用方式；可使用局部放大、引线、尺寸线、参数卡片或说明小窗；只标注图片可见或用户明确提供的信息，不得编造参数、材质、结构、工艺或认证。',
  卖点详解: '围绕2到3个不同核心卖点做综合拆解，形成购买理由；可使用主体产品、场景小窗、局部小窗、参数卡片、图标标签或证据模块；不得只讲单一卖点，不得做成大段文字，不得虚构品牌、型号、功效、材质等级或具体数值。',
}

const MAIN_FALLBACK_TYPES = Object.keys(IMAGE_PROMPT_TYPE_RULES)

/**
 * 从模型文本提取 JSON 对象：去代码围栏 → 首尾大括号截取 → 尾逗号清洗，逐候选解析。
 * 不引入 jsonrepair 依赖；解析失败返回 null，由上层按「提示词不完整」诚实处理。
 */
export function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const candidates = [cleaned]
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end >= start) candidates.unshift(cleaned.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      // 尝试去掉尾逗号后再解析
      const noTrailing = candidate.replace(/,(\s*[}\]])/g, '$1')
      try {
        return JSON.parse(noTrailing) as Record<string, unknown>
      } catch {
        // 尝试下一个候选
      }
    }
  }
  return null
}

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

export const DEFAULT_SLOT_CONFIGS: PromptSlot[] = [
  { id: 'image-1', name: '图1｜白底图', type: '白底图', sequence: 1 },
  { id: 'image-2', name: '图2｜场景图', type: '场景图', sequence: 2 },
  { id: 'image-3', name: '图3｜卖点图', type: '卖点图', sequence: 3 },
  { id: 'image-4', name: '图4｜细节说明', type: '细节说明', sequence: 4 },
  { id: 'image-5', name: '图5｜卖点详解', type: '卖点详解', sequence: 5 },
]

export function buildImagePromptGenerationPrompt(options: { settings?: PromptSettings; information?: string; designPlan?: string; promptSlots: PromptSlot[] }): string {
  const schema = options.promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整图生图提示词',
  }))
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = options.promptSlots.map((slot) => `【${slot.name}｜${slot.type}】\n${IMAGE_PROMPT_TYPE_RULES[slot.type] || ''}`).join('\n\n')

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
2. 每条 prompt 都必须严格基于对应图位的“主图设计规划”和该图位规则生成，不得只套用通用短规则。
3. 必须以用户上传的商品图为唯一商品主体，保持商品外观、颜色、结构、比例、关键部件、包装文字和可见特征一致，不替换商品，不生成其他品类。
4. 所有颜色、材质、结构、花型、纹理、参数、场景和文案都只能来自商品图片、商品信息或保守可确认的品类常识。
5. 同类型多张图必须各自有不同主题：场景图区分使用场景、人物姿势、镜头距离和光线；卖点图区分核心卖点；卖点详解图区分购买理由组合；细节说明图区分真实细节对象。
6. 每条 prompt 写成中文自然段，包含图位目标、主体要求、背景/场景、构图、光影、配色、文字版式、禁止事项，长度300-600字。
7. 文案必须短、清楚、适合${options.settings?.language || '简体中文'}，不得输出无法读清的小字、错字、无关品牌、水印、UI按钮或促销角标。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释或分析过程。
{
  "prompts": ${JSON.stringify(schema, null, 2)}
}`
}

export interface RetouchSlot {
  name?: string
  type?: string
}

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
