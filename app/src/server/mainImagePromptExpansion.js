import fs from 'fs'
import path from 'path'

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      if (process.env[key] != null) continue
      process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

const ARK_RESPONSES_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/responses'
const DEFAULT_ANALYSIS_MODEL = process.env.ARK_ANALYSIS_MODEL || 'doubao-seed-2-1-pro-260628'
const DEFAULT_SLOT_CONFIGS = [
  { id: 'image-1', name: '图1｜白底图', type: '白底图' },
  { id: 'image-2', name: '图2｜场景图', type: '场景图' },
  { id: 'image-3', name: '图3｜卖点图', type: '卖点图' },
  { id: 'image-4', name: '图4｜功能说明图', type: '功能说明图' },
  { id: 'image-5', name: '图5｜细节特写图', type: '细节特写图' },
]

function extractResponseText(data) {
  if (data.output_text) return data.output_text
  const parts = []
  for (const item of data.output || []) {
    if (item.text) parts.push(item.text)
    if (item.output_text) parts.push(item.output_text)
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text)
      if (content.output_text) parts.push(content.output_text)
      if (content.value) parts.push(content.value)
    }
  }
  return parts.join('\n')
}

function describeEmptyResponse(data) {
  const status = data?.status ? `状态：${data.status}` : ''
  const reason = data?.incomplete_details?.reason ? `原因：${data.incomplete_details.reason}` : ''
  const outputTypes = (data?.output || []).map((item) => item.type || item.role || '').filter(Boolean).join('、')
  const types = outputTypes ? `输出类型：${outputTypes}` : ''
  return [status, reason, types].filter(Boolean).join('；')
}

function parseJsonFromText(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeImageType(type, index) {
  const fallback = ['白底图', '场景图', '卖点图', '功能说明图', '细节特写图']
  return String(type || fallback[index] || `图${index + 1}`).trim()
}

function normalizePromptPayload(json, fallbackText = '') {
  const prompts = (Array.isArray(json?.prompts) ? json.prompts : []).slice(0, 5).map((item, index) => ({
    id: item.id || `image-${index + 1}`,
    name: item.name || `图${index + 1}｜${normalizeImageType(item.type, index)}`,
    type: normalizeImageType(item.type, index),
    prompt: String(item.prompt || '').trim(),
  })).filter((item) => item.prompt)

  return {
    information: String(json?.information || fallbackText || '').trim(),
    plan: String(json?.plan || '').trim(),
    prompts,
  }
}

function normalizeSelectedSlots(selectedSlots = []) {
  const allowed = new Map(DEFAULT_SLOT_CONFIGS.map((item) => [item.id, item]))
  const selectedIds = new Set((Array.isArray(selectedSlots) ? selectedSlots : [])
    .map((item) => typeof item === 'string' ? item : item?.id)
    .map((id) => String(id || '').trim())
    .filter((id) => allowed.has(id)))
  return DEFAULT_SLOT_CONFIGS.filter((item) => selectedIds.has(item.id))
}

function buildProductInfoPrompt({ settings, baseText, selectedSlots }) {
  const promptSchema = selectedSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '图生图提示词',
  }))
  const selectedRules = selectedSlots.map((slot) => `${slot.id} ${slot.name}`).join('、')
  return `你是一名电商商品信息帮写助手和电商主图提示词策划师。请根据用户上传的商品图片、用户已填写的内容以及页面生成设置，先识别整理商品信息，再为右侧 5 个套图图位分别生成可直接用于图生图的提示词。

【输入信息】

商品图片：用户上传的图片
用户填写内容：${String(baseText || '').trim() || '用户未填写内容'}
目标平台：${settings?.platform || '未设置'}
销售地区：${settings?.country || '未设置'}
页面语言：${settings?.language || '简体中文'}
用户勾选的图位：${selectedRules}

【处理规则】

1. 仔细识别商品图片中的商品类别、外观结构、颜色搭配、可见部件、装饰元素和可能的使用方式。

2. 如果用户输入完全为空：
根据图片识别结果，自动生成完整的商品名称、核心卖点、适用人群、使用场景和规格参数。

3. 如果用户只填写了商品名称：
保留用户提供的品牌、品类和明确属性，在此基础上优化商品名称，并根据图片补充其他信息。

4. 如果用户填写了商品名称和部分卖点：
先提取其中明确有效的商品信息，再进行归纳、改写和补充。不要直接照抄用户原文。

5. 用户输入中如果包含画面风格、排版、背景、转化效果等设计要求，只提取其中与商品功能和卖点有关的内容，不要把设计要求写入最终结果。

6. 商品名称应简洁清晰，可以按照“核心属性＋风格或功能＋商品品类”的方式组织。不得随意增加图片和用户输入中均无依据的品牌、型号、数量或技术参数。

7. 核心卖点固定生成3条，每条单独一行。采用“产品特征＋使用利益”的表达方式，语言简短、自然、有电商感。三条卖点应分别突出不同方向，避免重复。

8. 适用人群固定生成3类，使用顿号分隔。根据商品品类和实际用途进行合理判断。

9. 使用场景固定生成3个，使用顿号分隔。场景应具体、常见，并能体现商品用途。

10. 规格参数只整理2～3项图片中能够直接观察或用户明确提供的信息，例如颜色、外观、结构、底座、吊坠、鞋型、可见配件等。

11. 可以根据明显的图片特征和常见品类知识进行保守归纳，但不得虚构精度、容量、尺寸、材质等级、续航时间、防水等级、认证信息和其他具体技术参数。

12. 如果无法确认某项参数，不要输出“待确认”“未知”或解释性文字，直接省略该项。

13. 默认使用简体中文输出。平台、销售地区和页面语言仅作为商品表达方向参考，除非用户明确要求用其他语言输出。

【卖点文案要求】

- 每条只表达一个主要卖点
- 优先采用短句
- 不使用句号
- 避免空泛表达
- 避免三个卖点含义重复
- 可适度使用“一目了然、清晰直观、拆装便捷、透气不闷、佩戴灵活”等利益表达
- 不使用“最好、第一、百分百、绝对、永久”等绝对化词语

【输出格式】

必须只输出 JSON，不要使用 Markdown，不要输出分析过程、判断依据、提示说明或其他内容。

JSON 字段：
{
  "information": "严格按照商品信息格式输出：1、商品名称...2、核心卖点...3、适用人群...4、使用场景...5、规格参数...",
  "plan": "简要说明五张图分别承接什么卖点，使用中文纯文本",
  "prompts": ${JSON.stringify(promptSchema, null, 2)}
}

五张图提示词规则：
0. 只为“用户勾选的图位”生成 prompts，未勾选图位绝对不要出现在 prompts 数组里。
1. 所有 prompt 都必须明确：以用户上传的商品原图为唯一商品主体，保持商品外观、颜色、结构、包装文字和可见特征一致，不替换商品，不引入无依据品牌、型号、参数
2. 图1｜白底图：纯白或接近纯白背景，完整展示商品主体，构图居中，干净电商主图，不添加任何画面文案、贴纸、促销角标、图标或装饰元素
3. 图2｜场景图：选择一个最常见使用场景，商品为第一视觉中心，场景要服务于商品用途；允许 1 个短标题和最多 3 个短标签，文字要少、清楚、适合当前页面语言
4. 图3｜卖点图：只讲最重要的 1 个核心卖点，用商品局部、使用动作、对比、放大窗或视觉证据证明；允许 1 个短标题和 1 个短标签
5. 图4｜功能说明图：只讲 1 个结构、功能、规格或用法，不与图3重复；可以用引线、局部放大、信息小窗，但只标注图片可见或用户明确提供的信息
6. 图5｜细节特写图：展示真实可见细节、质感、边缘、结构、包装或使用触感，建立品质信任；可用多角度拼图或微距，但不得生成不存在的材质、接口、纹理、技术参数
7. 每条 prompt 写成中文自然段，包含：图位目标、主体要求、背景/场景、构图、光影、配色、文字版式、禁止事项，长度 180-360 字
8. 生成图片时需要保留用户上传商品图的核心形态，不要套用示例耳机图，也不要把其他品类元素放进画面`
}

export async function expandProductSetPrompts({ settings, baseText, image, selectedSlots }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('请先上传商品原图，再使用 AI 帮写。')
  const cleanSelectedSlots = normalizeSelectedSlots(selectedSlots)
  if (!cleanSelectedSlots.length) throw new Error('请先勾选需要生成提示词的图位。')
  const apiKey = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('后台未配置 ARK_API_KEY，请在服务端环境变量或 .env.local 中配置。')

  const response = await fetch(ARK_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: DEFAULT_ANALYSIS_MODEL,
      reasoning: { effort: 'low' },
      input: [{
        role: 'user',
        content: [
          { type: 'input_image', image_url: cleanImage },
          { type: 'input_text', text: buildProductInfoPrompt({ settings, baseText, selectedSlots: cleanSelectedSlots }) },
        ],
      }],
      max_output_tokens: 6000,
    }),
  })

  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { raw }
  }
  if (!response.ok) throw new Error(`豆包 Ark AI 帮写失败（HTTP ${response.status}）：${raw}`)

  const text = extractResponseText(payload).trim()
  if (!text) {
    const detail = describeEmptyResponse(payload)
    throw new Error(`AI 帮写没有返回可用内容${detail ? `（${detail}）` : ''}，请稍后重试。`)
  }
  const parsed = parseJsonFromText(text)
  const normalized = normalizePromptPayload(parsed, text)
  const selectedIds = new Set(cleanSelectedSlots.map((item) => item.id))
  normalized.prompts = normalized.prompts.filter((item) => selectedIds.has(item.id))
  if (!normalized.information && !normalized.prompts.length) throw new Error('AI 帮写没有返回可用商品信息或图位提示词，请稍后重试。')
  if (parsed && normalized.prompts.length < cleanSelectedSlots.length) throw new Error(`AI 帮写只返回了 ${normalized.prompts.length} 个图位提示词，少于已勾选的 ${cleanSelectedSlots.length} 个，请重试。`)

  return {
    ok: true,
    information: normalized.information,
    text: normalized.information,
    plan: normalized.plan,
    prompts: normalized.prompts,
    model: payload.model || DEFAULT_ANALYSIS_MODEL,
    usage: payload.usage || null,
  }
}
