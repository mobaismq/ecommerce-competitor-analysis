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

const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_ANALYSIS_MODEL = process.env.OPENROUTER_VISION_MODEL || 'deepseek/deepseek-v4-flash-vision-exp'
const FALLBACK_ANALYSIS_MODEL = process.env.OPENROUTER_VISION_FALLBACK_MODEL || 'openai/gpt-4.1-mini'
const STREAMING_INFORMATION_MAX_TOKENS = 5000
const OPENROUTER_TEXT_REASONING_EFFORT = process.env.OPENROUTER_TEXT_REASONING_EFFORT || 'minimal'
const DEFAULT_SLOT_CONFIGS = [
  { id: 'image-1', name: '图1｜白底图', type: '白底图' },
  { id: 'image-2', name: '图2｜场景图', type: '场景图' },
  { id: 'image-3', name: '图3｜卖点图', type: '卖点图' },
  { id: 'image-4', name: '图4｜细节说明', type: '细节说明' },
  { id: 'image-5', name: '图5｜卖点详解', type: '卖点详解' },
]

const IMAGE_PROMPT_TYPE_RULES = {
  '白底图': '纯白或接近纯白背景，单一完整商品主体居中展示，主体清晰、边缘干净、光线柔和均匀；不得添加标题、卖点文案、图标、贴纸、促销角标、人物、道具、尺寸线、引线、局部放大窗或多图拼贴。',
  '场景图': '生成一个完整真实的使用/佩戴/陈列场景，商品必须是第一视觉中心；场景服务于商品用途和风格，允许1个短标题和少量短标签；同批多张场景图必须在场景、人物姿势、镜头距离、光线氛围、标题和标签上明显不同。',
  '卖点图': '只聚焦1个核心卖点，用商品局部、佩戴/使用效果、放大窗、对比区或视觉证据证明；标题短、标签少、层级清晰；同批多张卖点图必须分别讲不同卖点，不得复用同一主标题、卖点词或版式。',
  '细节说明': '重点说明1个真实可见细节，或2到3个相互关联的真实细节、结构、尺寸关系、佩戴/使用方式；可使用局部放大、引线、尺寸线、参数卡片或说明小窗；只标注图片可见或用户明确提供的信息，不得编造参数、材质、结构、工艺或认证。',
  '卖点详解': '围绕2到3个不同核心卖点做综合拆解，形成购买理由；可使用主体产品、场景小窗、局部小窗、参数卡片、图标标签或证据模块；不得只讲单一卖点，不得做成大段文字，不得虚构品牌、型号、功效、材质等级或具体数值。',
}

const PROMPT_SPEC_DIR = process.env.PRODUCT_SET_PROMPT_SPEC_DIR || path.resolve(process.cwd(), 'guidelines/main-image-workflow')
const WORKFLOW_SPEC_FILES = {
  information: '生成信息整理补全.md',
  designPlan: '生成主图设计规划.md',
  '白底图': '生成图1白底图提示词.md',
  '场景图': '生成图2场景图提示词.md',
  '卖点图': '生成图3卖点图提示词.md',
  '细节说明': '生成图4细节说明图提示词.md',
  '卖点详解': '生成图5卖点详解图提示词.md',
}

const DETAIL_WORKFLOW_SPEC_DIR = process.env.DETAIL_WORKFLOW_SPEC_DIR || path.resolve(process.cwd(), 'guidelines/detail-workflow')
const DETAIL_MODULE_ORDER = [
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
const DETAIL_WORKFLOW_SPEC_FILES = {
  information: '生成信息整理补全.md',
  designPlan: '生成详情页设计规划.md',
  '首屏主视觉': '生成「首屏主视觉」的生图提示词.md',
  '核心卖点图': '生成「核心卖点图」的生图提示词.md',
  '使用场景图': '生成「使用场景图」的生图提示词.md',
  '多角度图': '生成「多角度图」的生图提示词.md',
  '场景氛围图': '生成「场景氛围图」的生图提示词.md',
  '商品细节图': '生成「商品细节图」的生图提示词.md',
  '品牌故事图': '输出「品牌故事图」的生图提示词.md',
  '尺寸/容量/尺码图': '输出「尺寸_容量_尺码图」的生图提示词.md',
  '效果对比图': '输出「效果对比图」的生图提示词.md',
  '详细规格/参数表': '输出「详细规格_参数表」的生图提示词.md',
  '工艺制作图': '输出「工艺制作图」的生图提示词.md',
  '配件/赠品图': '输出「配件_赠品图」的生图提示词.md',
  '系列展示图': '输出「系列展示图」的生图提示词.md',
  '商品成分图': '输出「商品成分图」的生图提示词.md',
  '售后保障图': '输出「售后保障图」的生图提示词.md',
  '使用建议图': '输出「使用建议图」的生图提示词.md',
}

function extractResponseText(data) {
  const choice = data?.choices?.[0]
  if (typeof choice?.text === 'string') return choice.text
  const choiceContent = choice?.message?.content
  if (typeof choiceContent === 'string') return choiceContent
  if (Array.isArray(choiceContent)) {
    return choiceContent
      .map((item) => item?.text || item?.content || item?.value || '')
      .filter(Boolean)
      .join('\n')
  }
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

function buildTextMessage(text) {
  return { role: 'user', content: String(text || '') }
}

function getOpenRouterApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('后台未配置 OPENROUTER_API_KEY，请在服务端环境变量或 .env.local 中配置。')
  return apiKey
}

function buildVisionMessage(text, image) {
  const content = [{ type: 'text', text }]
  const images = Array.isArray(image) ? image : [image]
  for (const item of images) {
    const cleanImage = String(item || '').trim()
    if (!cleanImage) continue
    content.push({
      type: 'image_url',
      image_url: { url: cleanImage },
    })
  }
  return { role: 'user', content }
}

function getOpenRouterVisionModels() {
  return Array.from(new Set([DEFAULT_ANALYSIS_MODEL, FALLBACK_ANALYSIS_MODEL].map((model) => String(model || '').trim()).filter(Boolean)))
}

function buildOpenRouterReasoningConfig(effort = OPENROUTER_TEXT_REASONING_EFFORT) {
  const cleanEffort = String(effort || '').trim()
  if (!cleanEffort || cleanEffort === 'off') return undefined
  return { effort: cleanEffort, exclude: true }
}

function isOpenRouterReasoningParamError(status, payload, raw) {
  const message = String(payload?.error?.message || payload?.message || raw || '')
  return status === 400 && /reasoning|reasoning_effort|effort|unsupported|not supported|mandatory/i.test(message)
}

function isOpenRouterRoutingPolicyError(status, payload, raw) {
  const message = String(payload?.error?.message || payload?.message || raw || '')
  return status === 404 && /No endpoints available matching|guardrail restrictions|data policy/i.test(message)
}

async function openOpenRouterChatResponse({ messages, maxTokens = 2000, timeoutMs = 120000, responseFormat, reasoning, stream = false } = {}) {
  let lastError = ''
  for (const model of getOpenRouterVisionModels()) {
    const reasoningAttempts = reasoning ? [reasoning, undefined] : [undefined]
    for (const reasoningConfig of reasoningAttempts) {
      const requestBody = {
        model,
        messages,
        max_tokens: maxTokens,
      }
      if (responseFormat) requestBody.response_format = responseFormat
      if (reasoningConfig) requestBody.reasoning = reasoningConfig
      if (stream) requestBody.stream = true

      const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getOpenRouterApiKey()}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(requestBody),
      })

      if (response.ok) return { response, model }

      const raw = await response.text()
      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = { raw }
      }
      lastError = `OpenRouter 模型调用失败（HTTP ${response.status}）：${raw}`
      if (reasoningConfig && isOpenRouterReasoningParamError(response.status, payload, raw)) continue
      if (isOpenRouterRoutingPolicyError(response.status, payload, raw)) break
      throw new Error(lastError)
    }
  }
  throw new Error(lastError || 'OpenRouter 模型调用失败：没有可用模型。')
}

async function callOpenRouterChat({ messages, maxTokens = 2000, timeoutMs = 120000, responseFormat, reasoning } = {}) {
  const { response, model } = await openOpenRouterChatResponse({
    messages,
    maxTokens,
    timeoutMs,
    responseFormat,
    reasoning,
  })
  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { raw }
  }
  if (!response.ok) {
    throw new Error(`OpenRouter 模型调用失败（HTTP ${response.status}）：${raw}`)
  }
  if (!payload.model) payload.model = model
  return payload
}

function describeEmptyResponse(data) {
  const model = data?.model ? `模型：${data.model}` : ''
  const choice = data?.choices?.[0]
  const finishReason = choice?.finish_reason ? `结束原因：${choice.finish_reason}` : ''
  const messageKeys = choice?.message && typeof choice.message === 'object'
    ? `消息字段：${Object.keys(choice.message).join(',')}`
    : ''
  const status = data?.status ? `状态：${data.status}` : ''
  const reason = data?.incomplete_details?.reason ? `原因：${data.incomplete_details.reason}` : ''
  const outputTypes = (data?.output || []).map((item) => item.type || item.role || '').filter(Boolean).join('、')
  const types = outputTypes ? `输出类型：${outputTypes}` : ''
  return [model, finishReason, messageKeys, status, reason, types].filter(Boolean).join('；')
}

function buildStageEmptyError(stage, payload) {
  const details = describeEmptyResponse(payload)
  return `${stage}没有返回可用内容，请重试。${details ? `（${details}）` : ''}`
}

function isLengthStopped(payload) {
  return String(payload?.choices?.[0]?.finish_reason || '').toLowerCase() === 'length'
}

async function callWorkflowStage({
  stage,
  messages,
  maxTokens,
  timeoutMs = 120000,
  responseFormat,
  retryWithoutResponseFormat = true,
  reasoning,
  lengthRetryMaxTokens,
} = {}) {
  const firstPayload = await callOpenRouterChat({
    messages,
    maxTokens,
    timeoutMs,
    responseFormat,
    reasoning,
  })
  const firstText = extractResponseText(firstPayload).trim()
  if (!firstText && isLengthStopped(firstPayload) && lengthRetryMaxTokens && lengthRetryMaxTokens > maxTokens) {
    const lengthRetryPayload = await callOpenRouterChat({
      messages,
      maxTokens: lengthRetryMaxTokens,
      timeoutMs,
      responseFormat,
      reasoning,
    })
    const lengthRetryText = extractResponseText(lengthRetryPayload).trim()
    if (lengthRetryText) return { payload: lengthRetryPayload, text: lengthRetryText }
    throw new Error(buildStageEmptyError(stage, lengthRetryPayload))
  }
  if (firstText || !responseFormat || !retryWithoutResponseFormat) {
    if (!firstText) throw new Error(buildStageEmptyError(stage, firstPayload))
    return { payload: firstPayload, text: firstText }
  }

  const retryPayload = await callOpenRouterChat({
    messages,
    maxTokens,
    timeoutMs,
    reasoning,
  })
  const retryText = extractResponseText(retryPayload).trim()
  if (!retryText) throw new Error(buildStageEmptyError(stage, retryPayload))
  return { payload: retryPayload, text: retryText }
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
  const fallback = ['白底图', '场景图', '卖点图', '细节说明', '卖点详解']
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

function normalizeRequestedPromptSlots(promptSlots = []) {
  const allowedTypes = new Set(Object.keys(IMAGE_PROMPT_TYPE_RULES))
  return (Array.isArray(promptSlots) ? promptSlots : [])
    .map((item, index) => {
      const type = String(item?.type || '').trim()
      if (!allowedTypes.has(type)) return null
      const sequence = Number.isFinite(Number(item?.sequence)) ? Number(item.sequence) : index + 1
      return {
        id: String(item?.id || `image-prompt-${index + 1}`).trim(),
        name: String(item?.name || `${String(sequence).padStart(2, '0')} ${type}`).trim(),
        type,
        sequence,
      }
    })
    .filter(Boolean)
    .slice(0, 20)
}

function readWorkflowSpec(key) {
  const fileName = WORKFLOW_SPEC_FILES[key]
  if (!fileName) return ''
  const filePath = path.join(PROMPT_SPEC_DIR, fileName)
  try {
    return fs.readFileSync(filePath, 'utf8').trim()
  } catch {
    return ''
  }
}

function readDetailWorkflowSpec(key) {
  const fileName = DETAIL_WORKFLOW_SPEC_FILES[key]
  if (!fileName) return ''
  const filePath = path.join(DETAIL_WORKFLOW_SPEC_DIR, fileName)
  try {
    return fs.readFileSync(filePath, 'utf8').trim()
  } catch {
    return ''
  }
}

function normalizeDetailModuleType(type) {
  const cleanType = String(type || '').trim()
  if (DETAIL_MODULE_ORDER.includes(cleanType)) return cleanType
  const normalized = cleanType
    .replace(/[／]/g, '/')
    .replace(/_/g, '/')
    .replace(/\s+/g, '')
  return DETAIL_MODULE_ORDER.find((item) => item.replace(/\s+/g, '') === normalized) || ''
}

function normalizeDetailPromptSlots(promptSlots = []) {
  const allowedTypes = new Set(DETAIL_MODULE_ORDER)
  const seen = new Set()
  const requested = (Array.isArray(promptSlots) ? promptSlots : [])
    .map((item, index) => {
      const type = normalizeDetailModuleType(typeof item === 'string' ? item : item?.type || item?.name)
      if (!allowedTypes.has(type) || seen.has(type)) return null
      seen.add(type)
      const sequence = Number.isFinite(Number(item?.sequence)) ? Number(item.sequence) : index + 1
      return {
        id: String(item?.id || `detail-${sequence}-${type}`).trim(),
        name: String(item?.name || `${String(sequence).padStart(2, '0')} ${type}`).trim(),
        type,
        sequence,
      }
    })
    .filter(Boolean)

  return DETAIL_MODULE_ORDER
    .map((type) => requested.find((slot) => slot.type === type))
    .filter(Boolean)
}

function buildDetailWorkflowInformationPrompt({ settings, baseText, reportText }) {
  const spec = readDetailWorkflowSpec('information')
  return `你正在执行商品详情图生成工作流第2步：信息整理补全。

【生成规范：生成信息整理补全.md】
${spec || '只整理产品事实信息，包含商品核心、平台、语种、画面参考风格、动作/道具建议、合规边界/信息缺口；不得编造不可见参数。'}

【输入】
用户上传商品图：已随消息提供
用户填写商品信息：${String(baseText || '').trim() || '用户未填写'}
引用AI报告分析结论：${String(reportText || '').trim() || '用户未引用AI报告'}
目标平台：${settings?.platform || '国内电商平台'}
销售地区：${settings?.country || '中国'}
画面语种：${settings?.language || '中文'}
输出比例：${settings?.ratio || '1:1'}

【输出要求】
1. 严格按规范输出“信息整理补全”正文。
2. 不生成详情页，不规划模块，不生成生图提示词。
3. 不输出分析过程、前言、结语或对话说明。`
}

function buildDetailWorkflowDesignPlanPrompt({ settings, information, promptSlots }) {
  const spec = readDetailWorkflowSpec('designPlan')
  const slotList = promptSlots.map((slot, index) => `${index + 1}. ${slot.type}`).join('\n')
  return `你正在执行商品详情图生成工作流第3步：详情页设计规划。

【生成规范：生成详情页设计规划.md】
${spec || '输出详情页总规划和已勾选模块规划，每行字段用｜连接。'}

【信息整理补全】
${String(information || '').trim()}

【页面设置】
目标平台：${settings?.platform || '国内电商平台'}
销售地区：${settings?.country || '中国'}
画面语种：${settings?.language || '中文'}
输出比例：${settings?.ratio || '1:1'}

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

function buildDetailImagePromptGenerationPrompt({ settings, information, designPlan, promptSlots }) {
  const schema = promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整详情图生图提示词',
  }))
  const slotList = promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = promptSlots.map((slot) => {
    const spec = readDetailWorkflowSpec(slot.type)
    return `【${slot.name}｜${slot.type}】\n${spec || '按该详情图模块规划输出一段可直接用于生图的最终提示词。'}`
  }).join('\n\n')

  return `你正在执行商品详情图生成工作流第4步：根据详情页设计规划生成各模块完整生图提示词。

【信息整理补全】
${String(information || '').trim()}

【详情页设计规划】
${String(designPlan || '').trim()}

【页面设置】
目标平台：${settings?.platform || '电商平台'}
销售地区：${settings?.country || '中国'}
画面语种：${settings?.language || '中文'}
输出比例：${settings?.ratio || '1:1'}

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

function buildWorkflowInformationPrompt({ settings, baseText, reportText }) {
  const spec = readWorkflowSpec('information')
  return `你正在执行商品主图生图工作流第2步：生成“信息整理补全”。

【生成规范】
${spec || '整理产品名称、品类、核心卖点、可见特征、适用人群、适用场景、具体参数、平台/地区和合规边界；不得编造不可见或未提供的信息。'}

【用户输入】
用户填写商品信息：${String(baseText || '').trim() || '用户未填写'}
引用AI报告内容：${String(reportText || '').trim() || '用户未引用AI报告'}
目标平台：${settings?.platform || '未设置'}
销售地区：${settings?.country || '未设置'}
画面语种：${settings?.language || '简体中文'}
输出比例：${settings?.ratio || '1:1'}

【输出要求】
必须只输出 JSON，不要使用 Markdown，不要输出分析过程。
{
  "information": "按规范生成的信息整理补全文本"
}`
}

function buildWorkflowDesignPlanPrompt({ settings, information, promptSlots }) {
  const spec = readWorkflowSpec('designPlan')
  const slotList = promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  return `你正在执行商品主图生图工作流第3步：生成“主图设计规划”。

【生成规范】
${spec || '按每个图位输出实际图位类型、核心视觉、展示视角、背景/风格、人物/道具建议、平台要求、品类策略、版式/文字排版、画面文案。'}

【信息整理补全】
${String(information || '').trim()}

【页面设置】
目标平台：${settings?.platform || '未设置'}
销售地区：${settings?.country || '未设置'}
画面语种：${settings?.language || '简体中文'}
输出比例：${settings?.ratio || '1:1'}

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

function buildImagePromptGenerationPrompt({ settings, information, designPlan, promptSlots }) {
  const schema = promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整图生图提示词',
  }))
  const slotList = promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = promptSlots.map((slot) => {
    const spec = readWorkflowSpec(slot.type)
    return `【${slot.name}｜${slot.type}】\n${spec || IMAGE_PROMPT_TYPE_RULES[slot.type] || ''}`
  }).join('\n\n')

  return `你正在执行商品主图生图工作流第4步：根据主图设计规划生成各图位完整生图提示词。

【信息整理补全】
${String(information || '').trim() || '以用户上传商品图中的可见信息为准'}

【主图设计规划】
${String(designPlan || '').trim()}

【页面设置】
目标平台：${settings?.platform || '电商平台'}
销售地区：${settings?.country || '未设置'}
页面语言：${settings?.language || '简体中文'}
输出比例：${settings?.ratio || '1:1'}

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
7. 文案必须短、清楚、适合${settings?.language || '简体中文'}，不得输出无法读清的小字、错字、无关品牌、水印、UI按钮或促销角标。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释或分析过程。
{
  "prompts": ${JSON.stringify(schema, null, 2)}
}`
}

function buildImageRetouchPromptGenerationPrompt({ settings, slot, originalPrompt, userDirection }) {
  const cleanDirection = String(userDirection || '').trim() || '在保持当前画面风格、商品主体、文字和版式基本不变的前提下，轻微优化画面质感和电商展示效果。'
  return `你正在为电商商品图生成一条“AI改图专用提示词”。

【参考图说明】
参考图1：用户上传的商品原图，是商品结构、颜色、材质、比例、佩戴关系和关键细节的最高事实依据。
参考图2：当前已生成图片，是版式、构图、背景、文案位置、光影氛围和画面风格参考。

【当前图位信息】
图位名称：${slot?.name || '未命名图位'}
图位类型：${slot?.type || '商品图'}
原始生图提示词：
${String(originalPrompt || '').trim() || '未提供'}

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

function normalizeGeneratedImagePrompts(json, promptSlots) {
  const rawPrompts = Array.isArray(json?.prompts) ? json.prompts : []
  const promptsById = new Map(rawPrompts.map((item) => [String(item?.id || '').trim(), item]))
  return promptSlots.map((slot, index) => {
    const raw = promptsById.get(slot.id) || rawPrompts[index] || {}
    return {
      id: slot.id,
      name: slot.name,
      type: slot.type,
      prompt: String(raw.prompt || '').trim(),
    }
  }).filter((item) => item.prompt)
}

function normalizeRetouchIntent(value) {
  const intent = String(value || '').trim()
  return ['retouch', 'style_scene', 'product_fix', 'text_edit'].includes(intent) ? intent : 'retouch'
}

function normalizeRetouchReferenceMode(value, intent) {
  const mode = String(value || '').trim()
  if (mode === 'current_only' || mode === 'product_and_current') return mode
  return intent === 'retouch' || intent === 'text_edit' ? 'current_only' : 'product_and_current'
}

function buildFallbackRetouchPrompt({ settings, slot, originalPrompt, userDirection }) {
  const direction = String(userDirection || '').trim() || '轻微优化画面质感和电商展示效果'
  return [
    '基于参考图进行电商图片定向改图。',
    '参考图1为用户上传商品原图，商品结构、颜色、材质、比例、佩戴关系和关键细节必须以参考图1为最高依据。',
    '参考图2为当前生成图，只用于保留图位类型、构图、版式、文案位置、背景方向和整体商业风格。',
    `当前图位：${slot?.name || ''} ${slot?.type || '商品图'}`.trim(),
    `用户修改要求：${direction}`,
    `原始生图提示词：${String(originalPrompt || '').trim() || '未提供'}`,
    `输出比例：${settings?.ratio || '1:1'}；画面语种：${settings?.language || '中文'}。`,
    '只修改用户明确指出的问题，其他部分保持稳定；不得新增无关文字、品牌、水印、促销角标、虚构参数、虚构材质或不存在的商品结构。',
  ].join('\n')
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
5. 图4｜细节说明：只讲 1 个真实可见细节、结构、规格或用法，不与图3重复；可以用引线、局部放大、信息小窗，但只标注图片可见或用户明确提供的信息
6. 图5｜卖点详解：围绕 2～3 个核心卖点做综合拆解，用图标、短文案、参数区或场景小窗增强理解；不得生成不存在的材质、接口、纹理、技术参数
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

async function generatePromptExpansionForInformation({ settings, information, image, model }) {
  const payload = await callOpenRouterChat({
    messages: [
      buildVisionMessage(buildProductInfoPrompt({
        settings,
        baseText: information,
        selectedSlots: DEFAULT_SLOT_CONFIGS,
      }), image),
    ],
    maxTokens: 6000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
  })
  const text = extractResponseText(payload).trim()
  const parsed = parseJsonFromText(text)
  const normalized = normalizePromptPayload(parsed, information)
  const allowedIds = new Set(DEFAULT_SLOT_CONFIGS.map((item) => item.id))
  const prompts = normalized.prompts.filter((item) => allowedIds.has(item.id))
  return {
    plan: normalized.plan,
    prompts,
    model: payload.model || model || DEFAULT_ANALYSIS_MODEL,
    usage: payload.usage || null,
  }
}

async function generateInformationFallback({ settings, baseText, image }) {
  const payload = await callOpenRouterChat({
    messages: [
      buildVisionMessage(buildStreamingInformationPrompt({ settings, baseText }), image),
    ],
    maxTokens: STREAMING_INFORMATION_MAX_TOKENS,
    timeoutMs: 120000,
    reasoning: buildOpenRouterReasoningConfig(),
  })
  const text = extractResponseText(payload).trim()
  return {
    text: normalizeProductInformationText(text, { final: true }),
    model: payload.model || DEFAULT_ANALYSIS_MODEL,
    usage: payload.usage || null,
  }
}

function buildFallbackPromptExpansion({ settings, information, model }) {
  const base = normalizeProductInformationText(information, { final: true }) || String(information || '').trim()
  const ratio = settings?.ratio || '1:1'
  const platform = settings?.platform || '电商平台'
  const language = settings?.language || '中文'
  const promptStart = `以用户上传的商品原图为唯一商品主体，保持商品外观、颜色、结构、包装文字和可见特征一致，不替换商品，不引入无依据品牌、型号、参数。商品信息：${base}`
  const prompts = [
    {
      id: 'image-1',
      name: '图1｜白底图',
      type: '白底图',
      prompt: `${promptStart}\n图位目标：生成${platform}可用的白底合规商品主图。背景使用纯白或接近纯白，商品完整居中展示，主体占画面主要面积，边缘清晰，光线柔和均匀，保留真实比例和可见细节。画面不要添加标题、卖点文案、图标、贴纸、促销角标、人物、额外道具或无依据装饰。输出比例：${ratio}，文字语言：${language}。`,
    },
    {
      id: 'image-2',
      name: '图2｜场景图',
      type: '场景图',
      prompt: `${promptStart}\n图位目标：生成突出真实使用氛围的场景图。选择与商品用途匹配的常见生活或消费场景，商品作为第一视觉中心，场景只用于衬托用途和风格，不喧宾夺主。构图干净，有自然光影和协调配色，可加入 1 个短标题和最多 3 个短标签，文案精简清楚，符合${language}表达。禁止替换商品、夸大功能或添加无依据参数。输出比例：${ratio}。`,
    },
    {
      id: 'image-3',
      name: '图3｜卖点图',
      type: '卖点图',
      prompt: `${promptStart}\n图位目标：生成聚焦单一核心卖点的卖点图。围绕最重要的一条卖点设计画面，用商品局部、使用动作、放大窗、对比区域或视觉证据说明优势。保留商品真实外观和主要细节，版式清晰，允许 1 个短标题和 1 个短标签，文字要短、有购买决策感。不要同时堆叠多个卖点，不要虚构认证、尺寸、材质等级或技术数据。输出比例：${ratio}，文字语言：${language}。`,
    },
    {
      id: 'image-4',
      name: '图4｜细节说明',
      type: '细节说明',
      prompt: `${promptStart}\n图位目标：生成细节说明图。选择图片中真实可见的结构、连接、边缘、装饰、质感、颜色或使用方式做清晰说明，使用局部放大、引线标注、信息小窗或分区布局呈现。文案只写可观察到或用户明确提供的信息，避免与卖点图重复。画面要保持商品真实形态，排版克制，背景简洁，信息层级明确。禁止编造不可见参数和不存在的细节。输出比例：${ratio}，文字语言：${language}。`,
    },
    {
      id: 'image-5',
      name: '图5｜卖点详解',
      type: '卖点详解',
      prompt: `${promptStart}\n图位目标：生成卖点详解图。围绕商品 2～3 个核心卖点进行系统拆解，可采用左右分栏、卡片信息区、图标标签、产品参数区或场景小窗组合呈现，帮助用户快速理解为什么值得购买。主商品必须清晰突出，文案短句化，层级分明，配色与商品一致。不要复用白底图构图，不要虚构品牌、型号、功效、材质等级或具体数值。输出比例：${ratio}，文字语言：${language}。`,
    },
  ]
  return {
    plan: '白底图负责合规展示，场景图负责使用氛围，卖点图聚焦单一核心优势，细节说明解释真实可见细节，卖点详解汇总购买理由。',
    prompts,
    model: model || DEFAULT_ANALYSIS_MODEL,
    usage: null,
  }
}

const IMAGE_TEXT_UI_BLACKLIST = [
  /^原图$/,
  /^AI改图$/,
  /^编辑文字$/,
  /^下载$/,
  /^全选$/,
  /^生成结果[:：]?$/,
  /^未识别到图片文字$/,
  /^\d{2}\s*(?:白底图|场景图|卖点图|细节说明|卖点详解|功能说明图|细节特写图|主图)/,
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
  const chatDelta = event.choices?.[0]?.delta?.content
  if (typeof chatDelta === 'string') return chatDelta
  if (Array.isArray(chatDelta)) {
    return chatDelta
      .map((item) => item?.text || item?.content || item?.value || '')
      .filter(Boolean)
      .join('')
  }
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
  const messageContent = event.choices?.[0]?.message?.content
  if (typeof messageContent === 'string') return messageContent.trim()
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

function parseOpenRouterStreamLine(line) {
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
  const cleanImages = (Array.isArray(image) ? image : [image])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  if (!cleanImages.length) throw new Error('请先上传商品原图，再使用 AI 帮写。')

  const thinkingSteps = [
    '读取商品图片与已填写内容',
    '识别商品主体、外观结构和可见细节',
    '提炼产品名称、核心卖点、人群和期望场景',
    '整理为可直接编辑的商品卖点结构',
  ]
  emitStreamEvent(emit, { type: 'thinking', text: thinkingSteps[0] })

  const { response, model } = await openOpenRouterChatResponse({
    messages: [
      buildVisionMessage(buildStreamingInformationPrompt({ settings, baseText }), cleanImages),
    ],
    stream: true,
    maxTokens: STREAMING_INFORMATION_MAX_TOKENS,
    timeoutMs: 120000,
    reasoning: buildOpenRouterReasoningConfig(),
  })
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
      const event = parseOpenRouterStreamLine(line)
      if (event) handleEvent(event)
    }
    if (done) break
  }

  const trailingEvent = parseOpenRouterStreamLine(buffer)
  if (trailingEvent) handleEvent(trailingEvent)

  let finalText = normalizeProductInformationText(completedText || generatedText, { final: true })
  let finalModel = model
  if (!finalText) {
    const fallback = await generateInformationFallback({ settings, baseText, image: cleanImages })
    finalText = fallback.text
    finalModel = fallback.model || model
  }
  if (!emittedText && finalText) {
    emitStreamEvent(emit, { type: 'content', text: finalText })
  }
  if (!finalText) throw new Error('AI 帮写没有返回可用商品信息，请稍后重试。')
  emitStreamEvent(emit, { type: 'thinking', text: '生成5张图独立提示词' })
  let promptExpansion
  try {
    promptExpansion = await generatePromptExpansionForInformation({
      settings,
      information: finalText,
      image: cleanImages,
      model: finalModel,
    })
  } catch {
    promptExpansion = buildFallbackPromptExpansion({ settings, information: finalText, model: finalModel })
  }
  if (!Array.isArray(promptExpansion?.prompts) || promptExpansion.prompts.length < DEFAULT_SLOT_CONFIGS.length) {
    promptExpansion = buildFallbackPromptExpansion({ settings, information: finalText, model: promptExpansion?.model || finalModel })
  }
  emitStreamEvent(emit, { type: 'thinking', text: '帮写完成，等待确认' })
  emitStreamEvent(emit, {
    type: 'done',
    text: finalText,
    plan: promptExpansion.plan || '',
    prompts: promptExpansion.prompts,
    model: promptExpansion.model || finalModel,
    usage: promptExpansion.usage || null,
  })
}

export async function extractProductSetImageText({ image }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('当前图片不可识别，请先完成生成后再编辑文字。')

  async function requestExtraction(retry = false) {
    const payload = await callOpenRouterChat({
      messages: [
        buildVisionMessage(buildImageTextExtractionPrompt({ retry }), cleanImage),
      ],
      maxTokens: retry ? 1200 : 900,
      timeoutMs: 90000,
      responseFormat: { type: 'json_object' },
      reasoning: buildOpenRouterReasoningConfig(),
    })

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

export async function generateDetailWorkflowPrompts({ settings, baseText, reportText, image, images, promptSlots }) {
  loadLocalEnv()
  const cleanImages = (Array.isArray(images) && images.length ? images : [image])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  if (!cleanImages.length) throw new Error('请先上传商品原图，再生成详情图工作流。')
  const cleanPromptSlots = normalizeDetailPromptSlots(promptSlots)
  if (!cleanPromptSlots.length) throw new Error('请至少选择一个详情图模块。')

  const { payload: informationPayload, text: informationText } = await callWorkflowStage({
    stage: '详情图信息整理补全',
    messages: [
      buildVisionMessage(buildDetailWorkflowInformationPrompt({
        settings,
        baseText,
        reportText,
      }), cleanImages),
    ],
    maxTokens: 6000,
    timeoutMs: 120000,
    retryWithoutResponseFormat: false,
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 10000,
  })
  const information = String(informationText || '').trim()
  if (!information) throw new Error(buildStageEmptyError('详情图信息整理补全', informationPayload))

  const { payload: designPayload, text: designText } = await callWorkflowStage({
    stage: '详情页设计规划',
    messages: [
      buildTextMessage(buildDetailWorkflowDesignPlanPrompt({
        settings,
        information,
        promptSlots: cleanPromptSlots,
      })),
    ],
    maxTokens: Math.min(16000, Math.max(6000, cleanPromptSlots.length * 900)),
    timeoutMs: 120000,
    retryWithoutResponseFormat: false,
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 16000,
  })
  const designPlan = String(designText || '').trim()
  if (!designPlan) throw new Error(buildStageEmptyError('详情页设计规划', designPayload))

  const { payload: promptPayload, text: promptText } = await callWorkflowStage({
    stage: '详情图生图提示词',
    messages: [
      buildTextMessage(buildDetailImagePromptGenerationPrompt({
        settings,
        information,
        designPlan,
        promptSlots: cleanPromptSlots,
      })),
    ],
    maxTokens: Math.min(20000, Math.max(6000, cleanPromptSlots.length * 1300)),
    timeoutMs: 180000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 20000,
  })
  const parsed = parseJsonFromText(promptText)
  const prompts = normalizeGeneratedImagePrompts(parsed, cleanPromptSlots)
  if (prompts.length < cleanPromptSlots.length) {
    throw new Error(`详情图提示词返回不完整：已返回 ${prompts.length} 个，需返回 ${cleanPromptSlots.length} 个。`)
  }

  return {
    ok: true,
    information,
    designPlan,
    prompts,
    model: promptPayload.model || designPayload.model || informationPayload.model || DEFAULT_ANALYSIS_MODEL,
    usage: promptPayload.usage || null,
  }
}

export async function generateProductSetImagePrompts({ settings, baseText, reportText, information, image, promptSlots }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('请先上传商品原图，再生成主图提示词。')
  const cleanPromptSlots = normalizeRequestedPromptSlots(promptSlots)
  if (!cleanPromptSlots.length) throw new Error('请至少选择一张要生成提示词的图片。')

  const { payload: informationPayload, text: informationText } = await callWorkflowStage({
    stage: '信息整理补全',
    messages: [
      buildVisionMessage(buildWorkflowInformationPrompt({
        settings,
        baseText: baseText ?? information,
        reportText,
      }), cleanImage),
    ],
    maxTokens: 4000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 8000,
  })
  const informationJson = parseJsonFromText(informationText)
  const completedInformation = normalizeProductInformationText(informationJson?.information || informationText, { final: true }) ||
    String(informationJson?.information || information || baseText || '').trim()
  if (!completedInformation) throw new Error('信息整理补全没有返回可用内容，请重试。')

  const { payload: designPayload, text: designText } = await callWorkflowStage({
    stage: '主图设计规划',
    messages: [
      buildTextMessage(buildWorkflowDesignPlanPrompt({
        settings,
        information: completedInformation,
        promptSlots: cleanPromptSlots,
      })),
    ],
    maxTokens: 6000,
    timeoutMs: 120000,
    retryWithoutResponseFormat: false,
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 12000,
  })
  const designJson = parseJsonFromText(designText)
  const designPlan = String(designJson?.designPlan || designText || '').trim()
  if (!designPlan) throw new Error(buildStageEmptyError('主图设计规划', designPayload))

  const { payload: promptPayload, text } = await callWorkflowStage({
    stage: '主图提示词',
    messages: [
      buildTextMessage(buildImagePromptGenerationPrompt({
        settings,
        information: completedInformation,
        designPlan,
        promptSlots: cleanPromptSlots,
      })),
    ],
    maxTokens: Math.min(12000, Math.max(4000, cleanPromptSlots.length * 1200)),
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 12000,
  })

  const parsed = parseJsonFromText(text)
  const prompts = normalizeGeneratedImagePrompts(parsed, cleanPromptSlots)
  if (prompts.length < cleanPromptSlots.length) {
    throw new Error('主图提示词返回不完整，请重试。')
  }

  return {
    ok: true,
    information: completedInformation,
    designPlan,
    prompts,
    model: promptPayload.model || designPayload.model || informationPayload.model || DEFAULT_ANALYSIS_MODEL,
    usage: promptPayload.usage || null,
  }
}

export async function generateProductSetRetouchPrompt({ settings, slot, originalPrompt, userDirection, originalImage, currentImage }) {
  loadLocalEnv()
  const cleanCurrentImage = String(currentImage || '').trim()
  if (!cleanCurrentImage) throw new Error('当前图片不可编辑，请先完成生成后再操作。')
  const referenceImages = [originalImage, cleanCurrentImage].map((item) => String(item || '').trim()).filter(Boolean)
  const promptText = buildImageRetouchPromptGenerationPrompt({
    settings,
    slot,
    originalPrompt,
    userDirection,
  })

  const { payload, text } = await callWorkflowStage({
    stage: 'AI改图提示词',
    messages: [
      buildVisionMessage(promptText, referenceImages.length ? referenceImages : cleanCurrentImage),
    ],
    maxTokens: 1800,
    timeoutMs: 90000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
    lengthRetryMaxTokens: 3000,
  })
  const parsed = parseJsonFromText(text) || {}
  const intent = normalizeRetouchIntent(parsed.intent)
  const referenceMode = normalizeRetouchReferenceMode(parsed.referenceMode, intent)
  const generatedPrompt = String(parsed.prompt || '').trim()
  const prompt = generatedPrompt || buildFallbackRetouchPrompt({
    settings,
    slot,
    originalPrompt,
    userDirection,
  })

  return {
    ok: true,
    intent,
    referenceMode,
    prompt,
    model: payload.model || DEFAULT_ANALYSIS_MODEL,
    usage: payload.usage || null,
  }
}

export async function expandProductSetPrompts({ settings, baseText, image, selectedSlots, informationOnly = false }) {
  loadLocalEnv()
  const cleanImage = String(image || '').trim()
  if (!cleanImage) throw new Error('请先上传商品原图，再使用 AI 帮写。')
  const cleanSelectedSlots = normalizeSelectedSlots(selectedSlots)
  if (!informationOnly && !cleanSelectedSlots.length) throw new Error('请先勾选需要生成提示词的图位。')
  const inputText = informationOnly
    ? buildInformationOnlyPrompt({ settings, baseText })
    : buildProductInfoPrompt({ settings, baseText, selectedSlots: cleanSelectedSlots })

  const payload = await callOpenRouterChat({
    messages: [
      buildVisionMessage(inputText, cleanImage),
    ],
    maxTokens: informationOnly ? 1400 : 6000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
    reasoning: buildOpenRouterReasoningConfig(),
  })

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
