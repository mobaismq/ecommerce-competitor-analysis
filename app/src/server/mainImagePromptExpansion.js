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
    information: normalizeProductInformationText(json?.information || fallbackText || '', { final: true }),
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

const PRODUCT_INFORMATION_FIELDS = [
  { key: 'name', label: '产品名称', aliases: ['产品名称', '商品名称'] },
  { key: 'sellingPoints', label: '核心卖点', aliases: ['核心卖点', '商品卖点', '卖点'] },
  { key: 'audience', label: '适用人群', aliases: ['适用人群', '目标人群'] },
  { key: 'scenario', label: '期望场景', aliases: ['期望场景', '使用场景', '适用场景'] },
  { key: 'specs', label: '具体参数', aliases: ['具体参数', '规格参数', '商品参数'] },
]
const PRODUCT_INFORMATION_FALLBACKS = {
  name: '根据商品图片识别的产品',
  sellingPoints: '外观精致，细节清晰，适合商品主图展示',
  audience: '日常消费人群、礼赠需求人群、风格穿搭人群',
  scenario: '日常使用、通勤出行、礼赠搭配',
  specs: '以商品图片可见信息和用户补充内容为准',
}
const PRODUCT_INFORMATION_ALIAS_TO_KEY = new Map(PRODUCT_INFORMATION_FIELDS.flatMap((field) => field.aliases.map((alias) => [alias, field.key])))
const PRODUCT_INFORMATION_ALIAS_RE = PRODUCT_INFORMATION_FIELDS
  .flatMap((field) => field.aliases)
  .sort((a, b) => b.length - a.length)
  .join('|')
const PRODUCT_INFORMATION_FIELD_RE = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\s*[、.．]\\s*)?(${PRODUCT_INFORMATION_ALIAS_RE})\\s*(?:[:：]|(?=\\s|\\n|$))`, 'g')
const LEAKED_REASONING_START_RE = /^(?:用户现在需要|用户需要|我现在需要|我现在|我(?:已|已经|会|来|需要|要|正在)|现在(?:我)?(?:先|需要)|下面|以下|接下来|对吧|好的|可以|没问题|根据(?:用户|图片)|让我们|先来|我将|这里|确认|明确|整理|梳理|分析)/
const LEAKED_REASONING_INLINE_RE = /(?:。|；|;)?\s*(?:用户现在需要|用户需要|我(?:已|已经|会|来|需要|要|正在|核对|确认|明确)|本次整理|下面|以下)[\s\S]*$/

function cleanProductInformationValue(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^[\-•·*]\s*/, ''))
    .filter((line) => line && !LEAKED_REASONING_START_RE.test(line))
    .join('\n')
    .replace(LEAKED_REASONING_INLINE_RE, '')
    .replace(/^(?:是|为)\s*/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getLooseProductInformationValue(raw, labels, stopLabels) {
  const source = String(raw || '').replace(/\s+/g, ' ').trim()
  for (const label of labels) {
    const index = source.indexOf(label)
    if (index < 0) continue
    let value = source.slice(index + label.length)
      .replace(/^\s*(?:[:：]|为|是|包括|如下|分别为|有|：|:)\s*/, '')
    const stopIndex = stopLabels
      .map((stopLabel) => value.indexOf(stopLabel))
      .filter((item) => item >= 0)
      .sort((a, b) => a - b)[0]
    if (stopIndex >= 0) value = value.slice(0, stopIndex)
    value = cleanProductInformationValue(value.replace(/[。；;]\s*$/, ''))
    if (value) return value
  }
  return ''
}

function extractLooseProductInformationFields(text) {
  const raw = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  const fields = {}
  const nameMatch = raw.match(/(?:目标商品|产品名称|商品名称)\s*(?:为|是|[:：])\s*([^，。；;,.]{2,80})/)
  const name = cleanProductInformationValue(nameMatch?.[1] || '')
  if (name) fields.name = name
  const sellingPoints = getLooseProductInformationValue(
    raw,
    ['核心卖点', '商品卖点', '卖点'],
    ['适用人群', '目标人群', '期望场景', '使用场景', '具体参数', '规格参数', '商品参数'],
  )
  if (sellingPoints) fields.sellingPoints = sellingPoints
  const audience = getLooseProductInformationValue(
    raw,
    ['适用人群', '目标人群'],
    ['期望场景', '使用场景', '具体参数', '规格参数', '商品参数'],
  )
  if (audience) fields.audience = audience
  const scenario = getLooseProductInformationValue(
    raw,
    ['期望场景', '使用场景', '适用场景'],
    ['具体参数', '规格参数', '商品参数'],
  )
  if (scenario) fields.scenario = scenario
  const specs = getLooseProductInformationValue(raw, ['具体参数', '规格参数', '商品参数'], [])
  if (specs) fields.specs = specs
  return Object.values(fields).some(Boolean) ? fields : null
}

function parseProductInformationFields(text) {
  const raw = String(text || '').replace(/```[\s\S]*?```/g, '').trimStart()
  if (!raw) return null
  const matches = Array.from(raw.matchAll(PRODUCT_INFORMATION_FIELD_RE))
  if (!matches.length) return null
  const parsed = {}
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const alias = match[1]
    const key = PRODUCT_INFORMATION_ALIAS_TO_KEY.get(alias)
    if (!key) continue
    const start = (match.index || 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length
    const value = cleanProductInformationValue(raw.slice(start, end))
    if (!value) continue
    parsed[key] = parsed[key] ? `${parsed[key]}\n${value}` : value
  }
  return parsed
}

function normalizeProductInformationText(text, { final = false } = {}) {
  const fields = parseProductInformationFields(text) || (final ? extractLooseProductInformationFields(text) : null)
  if (!fields) return ''
  const requiredKeys = PRODUCT_INFORMATION_FIELDS.map((field) => field.key)
  const filledCount = requiredKeys.filter((key) => fields[key]).length
  if (final && filledCount < 2) return ''
  if (final) {
    requiredKeys.forEach((key) => {
      if (!fields[key]) fields[key] = PRODUCT_INFORMATION_FALLBACKS[key]
    })
  }
  const availableFields = PRODUCT_INFORMATION_FIELDS.filter((field) => fields[field.key])
  if (!availableFields.length) return ''
  if (!fields.name && !final) return ''
  return availableFields
    .map((field, index) => {
      const value = cleanProductInformationValue(fields[field.key])
      return field.key === 'sellingPoints'
        ? `${index + 1}.${field.label}：\n${value}`
        : `${index + 1}.${field.label}：${value.replace(/\n+/g, '、')}`
    })
    .join('\n')
    .trim()
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
根据图片识别结果，自动生成完整的产品名称、核心卖点、适用人群、期望场景和具体参数。

3. 如果用户只填写了产品名称：
保留用户提供的品牌、品类和明确属性，在此基础上优化产品名称，并根据图片补充其他信息。

4. 如果用户填写了产品名称和部分卖点：
先提取其中明确有效的商品信息，再进行归纳、改写和补充。不要直接照抄用户原文。

5. 用户输入中如果包含画面风格、排版、背景、转化效果等设计要求，只提取其中与商品功能和卖点有关的内容，不要把设计要求写入最终结果。

6. 产品名称应简洁清晰，可以按照“核心属性＋风格或功能＋商品品类”的方式组织。不得随意增加图片和用户输入中均无依据的品牌、型号、数量或技术参数。

7. 核心卖点固定生成3条，每条单独一行。采用“产品特征＋使用利益”的表达方式，语言简短、自然、有电商感。三条卖点应分别突出不同方向，避免重复。

8. 适用人群固定生成3类，使用顿号分隔。根据商品品类和实际用途进行合理判断。

9. 期望场景固定生成3个，使用顿号分隔。场景应具体、常见，并能体现商品用途。

10. 具体参数只整理2～3项图片中能够直接观察或用户明确提供的信息，例如颜色、外观、结构、底座、吊坠、鞋型、可见配件等。

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
  "information": "严格按照商品信息格式输出：1.产品名称...2.核心卖点...3.适用人群...4.期望场景...5.具体参数...",
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

function buildInformationOnlyPrompt({ settings, baseText }) {
  return `你是一名电商商品卖点帮写助手。请根据用户上传的商品图片和已填写内容，快速整理一段可直接放入“商品卖点&要求”输入框的商品信息。

【输入信息】
商品图片：用户上传的图片
用户填写内容：${String(baseText || '').trim() || '用户未填写内容'}
目标平台：${settings?.platform || '未设置'}
销售地区：${settings?.country || '未设置'}
页面语言：${settings?.language || '简体中文'}

【要求】
1. 只输出商品信息，不输出分析过程。
2. 结构固定为：1.产品名称；2.核心卖点；3.适用人群；4.期望场景；5.具体参数。
3. 核心卖点写 3 条，每条短句，突出不同方向。
4. 适用人群写 3 类，使用顿号分隔。
5. 期望场景写 3 个，使用顿号分隔。
6. 具体参数只写图片中能观察到或用户明确提供的信息，不虚构尺寸、材质等级、认证、容量、防水、续航等具体参数。
7. 默认使用简体中文。

必须只输出 JSON：
{
  "information": "1.产品名称：...\\n2.核心卖点：\\n...\\n3.适用人群：...\\n4.期望场景：...\\n5.具体参数：..."
  }`
}

function buildStreamingInformationPrompt({ settings, baseText }) {
  return `你是一名电商商品卖点帮写助手。请根据用户上传的商品图片和已填写内容，直接生成一段可放入“商品卖点&要求”输入框的商品信息。

【输入信息】
商品图片：用户上传的图片
用户填写内容：${String(baseText || '').trim() || '用户未填写内容'}
目标平台：${settings?.platform || '未设置'}
销售地区：${settings?.country || '未设置'}
页面语言：${settings?.language || '简体中文'}

【输出要求】
1. 直接输出最终可用正文，不要输出 JSON，不要使用 Markdown，不要输出分析过程、对话过程或确认过程。
2. 结构固定为：
1.产品名称：...
2.核心卖点：
...
3.适用人群：...
4.期望场景：...
5.具体参数：...
3. 核心卖点写 3 条，每条短句，突出不同方向。
4. 适用人群写 3 类，使用顿号分隔。
5. 期望场景写 3 个，使用顿号分隔。
6. 具体参数只写图片中能观察到或用户明确提供的信息，不虚构尺寸、材质等级、认证、容量、防水、续航等具体参数。
7. 默认使用简体中文。

【绝对禁止】
1. 禁止输出“用户现在需要”“我已经”“我会”“我已明确”“我来整理”“下面是”“以下是”“对吧”等对话、复述需求、确认文字或分析文字。
2. 禁止解释你的思考过程、判断依据、整理过程。
3. 第一行必须从“1.产品名称：”开始，前面不得有任何其他文字。
4. 禁止使用第一人称叙述，不要说“我现在”“我已经”“我明确”“我梳理”。
5. 除固定 5 个栏目外，不允许输出任何前言、结语或提示。`
}

const IMAGE_TEXT_UI_BLACKLIST = [
  /^原图$/,
  /^AI改图$/,
  /^编辑文字$/,
  /^下载$/,
  /^全选$/,
  /^生成结果[:：]?$/,
  /^未识别到图片文字$/,
  /^\d{2}\s*(?:白底图|场景图|卖点图|功能说明图|细节特写图|主图)/,
]

function buildImageTextExtractionPrompt({ retry = false } = {}) {
  return `你是电商图片 OCR 文案提取智能体。请只识别用户提供图片画面中真实可见的文案。

规则：
1. 只提取图片本身包含的文字、数字、符号、短句，按视觉阅读顺序输出。
2. 不要根据商品、品类、提示词、常识或页面上下文补写任何文字。
3. 不要输出网页 UI 叠加标签，例如“01 白底图”“02 场景图”“下载”“AI改图”“编辑文字”等。
4. 需要重点识别图片里的标题、卖点短句、参数、底部说明、小字、白色描边字、贴纸字和拼图中的文字。
5. 同一段文案如果被换行拆开，请合并成一句；相同文案只输出一次。
6. 如果图片中没有可识别文字，返回空数组。
${retry ? '7. 上一次没有识别到文字，这次请更积极检查图片边缘、底部、小字和浅色文字；只要能辨认就输出。' : ''}

必须只输出 JSON，不要使用 Markdown：
{
  "texts": ["图片中真实可见的文案1", "图片中真实可见的文案2"]
}`
}

function cleanExtractedTextLine(value) {
  const text = String(value || '')
    .replace(/^[\s"'`*•·\-—、，。:：]+/, '')
    .replace(/[\s"'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (/^(?:texts|items|text)\b/i.test(text)) return ''
  if (/^[\[\]{}:,]+$/.test(text)) return ''
  if (IMAGE_TEXT_UI_BLACKLIST.some((pattern) => pattern.test(text))) return ''
  return text
}

function collectCandidateTextLines(rawText) {
  return String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/[{}[\]]/g, '\n')
    .split(/\r?\n|\\n|；|;/)
    .map((line) => line.replace(/^\s*(?:"texts"|"items"|"text")\s*[:：]\s*/i, ''))
    .map((line) => line.replace(/^\s*["']?text["']?\s*[:：]\s*/i, ''))
    .map((line) => line.replace(/^\s*\d+\s*[、.．]\s*/, ''))
    .map((line) => line.replace(/^[\s,，"']+|[\s,，"']+$/g, ''))
    .map(cleanExtractedTextLine)
    .filter(Boolean)
}

function normalizeExtractedTexts(json, fallbackText = '') {
  const source = Array.isArray(json?.texts) ? json.texts : Array.isArray(json?.items) ? json.items : []
  const seen = new Set()
  const texts = []
  const addText = (item) => {
    const value = typeof item === 'string' ? item : item?.text
    const text = cleanExtractedTextLine(value)
    if (!text || seen.has(text)) return
    seen.add(text)
    texts.push(text)
  }
  for (const item of source) addText(item)
  if (!texts.length) {
    for (const item of collectCandidateTextLines(fallbackText)) addText(item)
  }
  return texts.slice(0, 20)
}

function emitStreamEvent(emit, event) {
  if (typeof emit === 'function') emit(event)
}

function extractStreamTextDelta(event) {
  if (!event || typeof event !== 'object') return ''
  const eventType = String(event.type || '')
  if (typeof event.delta === 'string') return event.delta
  if (typeof event.text === 'string' && eventType.includes('delta')) return event.text
  if (typeof event.output_text_delta === 'string') return event.output_text_delta
  if (typeof event.content === 'string' && eventType.includes('delta')) return event.content
  if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') return event.delta
  if (event.type === 'response.text.delta' && typeof event.delta === 'string') return event.delta
  const content = event.item?.content || event.content
  if (eventType.includes('delta') && Array.isArray(content)) {
    return content
      .map((item) => item?.delta || item?.text || item?.output_text || item?.value || '')
      .filter(Boolean)
      .join('')
  }
  return ''
}

function extractStreamCompletedText(event) {
  if (!event || typeof event !== 'object') return ''
  if (event.type === 'response.completed' && event.response) return extractResponseText(event.response).trim()
  if (event.response?.output_text) return String(event.response.output_text).trim()
  if (event.output_text && !String(event.type || '').includes('delta')) return String(event.output_text).trim()
  if (String(event.type || '').includes('done') && typeof event.text === 'string') return event.text.trim()
  return ''
}

function streamErrorFromEvent(event) {
  if (!event || typeof event !== 'object') return ''
  const error = event.error || event.response?.error
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || JSON.stringify(error)
}

function parseArkStreamLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return null
  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export async function streamProductSetInformation({ settings, baseText, image, emit }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('请先上传商品原图，再使用 AI 帮写。')
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) throw new Error('后台未配置 ARK_API_KEY，请在服务端环境变量或 .env.local 中配置。')

  const thinkingSteps = [
    '读取商品图片与已填写内容',
    '识别商品主体、外观结构和可见细节',
    '提炼产品名称、核心卖点、人群和期望场景',
    '整理为可直接编辑的商品卖点结构',
  ]
  emitStreamEvent(emit, { type: 'thinking', text: thinkingSteps[0] })

  const response = await fetch(ARK_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: DEFAULT_ANALYSIS_MODEL,
      stream: true,
      input: [{
        role: 'user',
        content: [
          { type: 'input_image', image_url: cleanImage },
          { type: 'input_text', text: buildStreamingInformationPrompt({ settings, baseText }) },
        ],
      }],
      max_output_tokens: 1400,
    }),
  })

  if (!response.ok) {
    const raw = await response.text()
    throw new Error(`豆包 Ark AI 帮写失败（HTTP ${response.status}）：${raw}`)
  }
  if (!response.body) throw new Error('AI 帮写接口没有返回流式内容，请稍后重试。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let generatedText = ''
  let completedText = ''
  let emittedText = ''
  let stepIndex = 1

  function emitVisibleText() {
    const visibleText = normalizeProductInformationText(generatedText)
    if (!visibleText || visibleText.length <= emittedText.length) return
    const delta = visibleText.slice(emittedText.length)
    emittedText = visibleText
    emitStreamEvent(emit, { type: 'content', text: delta })
  }

  function handleEvent(event) {
    const eventError = streamErrorFromEvent(event)
    if (eventError) throw new Error(eventError)
    const completed = extractStreamCompletedText(event)
    if (completed) completedText = completed
    const delta = extractStreamTextDelta(event)
    if (!delta) return
    if (stepIndex < thinkingSteps.length) {
      emitStreamEvent(emit, { type: 'thinking', text: thinkingSteps[stepIndex] })
      stepIndex += 1
    }
    generatedText += delta
    emitVisibleText()
  }

  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      const event = parseArkStreamLine(line)
      if (event) handleEvent(event)
    }
    if (done) break
  }

  const trailingEvent = parseArkStreamLine(buffer)
  if (trailingEvent) handleEvent(trailingEvent)

  const finalText = normalizeProductInformationText(completedText || generatedText, { final: true })
  if (!emittedText && finalText) {
    emitStreamEvent(emit, { type: 'content', text: finalText })
  }
  if (!finalText) throw new Error('AI 帮写没有返回可用商品信息，请稍后重试。')
  emitStreamEvent(emit, { type: 'thinking', text: '帮写完成，等待确认' })
  emitStreamEvent(emit, { type: 'done', text: finalText, model: DEFAULT_ANALYSIS_MODEL })
}

export async function extractProductSetImageText({ image }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('当前图片不可识别，请先完成生成后再编辑文字。')
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) throw new Error('后台未配置 ARK_API_KEY，请在服务端环境变量或 .env.local 中配置。')

  async function requestExtraction(retry = false) {
    const response = await fetch(ARK_RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: DEFAULT_ANALYSIS_MODEL,
        reasoning: { effort: retry ? 'medium' : 'low' },
        input: [{
          role: 'user',
          content: [
            { type: 'input_image', image_url: cleanImage },
            { type: 'input_text', text: buildImageTextExtractionPrompt({ retry }) },
          ],
        }],
        max_output_tokens: retry ? 1200 : 900,
      }),
    })

    const raw = await response.text()
    let payload
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = { raw }
    }
    if (!response.ok) throw new Error(`图片文字识别失败（HTTP ${response.status}）：${raw}`)

    const text = extractResponseText(payload).trim()
    const parsed = parseJsonFromText(text)
    return {
      payload,
      texts: normalizeExtractedTexts(parsed, text),
    }
  }

  const firstResult = await requestExtraction(false)
  const finalResult = firstResult.texts.length ? firstResult : await requestExtraction(true)
  return {
    ok: true,
    texts: finalResult.texts,
    model: finalResult.payload.model || DEFAULT_ANALYSIS_MODEL,
    usage: finalResult.payload.usage || null,
  }
}

export async function expandProductSetPrompts({ settings, baseText, image, selectedSlots, informationOnly = false }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('请先上传商品原图，再使用 AI 帮写。')
  const cleanSelectedSlots = normalizeSelectedSlots(selectedSlots)
  if (!informationOnly && !cleanSelectedSlots.length) throw new Error('请先勾选需要生成提示词的图位。')
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) throw new Error('后台未配置 ARK_API_KEY，请在服务端环境变量或 .env.local 中配置。')
  const inputText = informationOnly
    ? buildInformationOnlyPrompt({ settings, baseText })
    : buildProductInfoPrompt({ settings, baseText, selectedSlots: cleanSelectedSlots })

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
          { type: 'input_text', text: inputText },
        ],
      }],
      max_output_tokens: informationOnly ? 1400 : 6000,
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
  normalized.prompts = informationOnly ? [] : normalized.prompts.filter((item) => selectedIds.has(item.id))
  if (!normalized.information && !normalized.prompts.length) throw new Error('AI 帮写没有返回可用商品信息或图位提示词，请稍后重试。')
  if (!informationOnly && parsed && normalized.prompts.length < cleanSelectedSlots.length) throw new Error(`AI 帮写只返回了 ${normalized.prompts.length} 个图位提示词，少于已勾选的 ${cleanSelectedSlots.length} 个，请重试。`)

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
