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
const DEFAULT_ANALYSIS_MODEL = process.env.ARK_ANALYSIS_MODEL || 'doubao-seed-2-0-pro-260215'

function extractResponseText(data) {
  if (data.output_text) return data.output_text
  const parts = []
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text)
    }
  }
  return parts.join('\n')
}

function parseJsonFromText(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`提示词扩写没有返回可解析 JSON：${cleaned.slice(0, 240)}`)
  return JSON.parse(cleaned.slice(start, end + 1))
}

function normalizeImageType(type, index) {
  const fallback = ['白底图', '场景图', '卖点图', '功能说明图', '细节特写图']
  return String(type || fallback[index] || `图${index + 1}`).trim()
}

function normalizePromptPayload(json) {
  const prompts = (Array.isArray(json.prompts) ? json.prompts : []).slice(0, 5).map((item, index) => ({
    id: item.id || `image-${index + 1}`,
    name: item.name || `图${index + 1}｜${normalizeImageType(item.type, index)}`,
    type: normalizeImageType(item.type, index),
    prompt: String(item.prompt || '').trim(),
  })).filter((item) => item.prompt)

  if (!prompts.length) throw new Error('提示词扩写成功但没有生成可用提示词')
  return {
    ok: true,
    information: json.information || '',
    plan: json.plan || '',
    prompts,
  }
}

function buildExpansionInstruction({ product, priceBand, settings, baseText }) {
  return [
    '你正在执行 ecommerce-main-image-generator skill 的前 3 步：',
    '1. 生成「信息整理补全」',
    '2. 生成「主图设计规划」',
    '3. 生成默认 5 张电商主图的生图提示词',
    '',
    '目标：根据用户提供的商品主图生图文本、上传商品图、平台/地区/语种/比例设置，输出可直接给图生图模型使用的 5 张主图提示词。',
    '',
    '必须遵守：',
    '1. baseText 是唯一业务主题来源，必须优先读取和整理；不要额外引入 priceBand 字段，也不要把页面选择的价格段写进提示词，除非 baseText 本身明确写了价格带。',
    '2. 默认生成 5 张：图1｜白底图、图2｜场景图、图3｜卖点图、图4｜功能说明图、图5｜细节特写图。',
    '3. 先做信息整理补全，再做主图设计规划，最后再写 5 条最终生图提示词；prompts 不能跳过前两步的结论。',
    '4. 不得编造精度、尺寸、容量、认证、防水等级、续航、材质等级、品牌名、型号等强事实参数；没有依据就保守表达。',
    '5. 保持上传商品图的产品身份：颜色、结构、比例、关键部件、按钮、接口、包装、材质和轮廓必须一致，不得变形、拉伸、改色、换品牌。',
    '6. 平台未指定时按国内电商处理；国内平台默认中文，跨境平台默认英文；settings.language 明确时按 settings.language。',
    '7. 先建立「上架卖点矩阵」：核心卖点 -> 用户顾虑 -> 画面证明方式 -> 建议图位 -> 建议上图文案。每个核心卖点至少被一个图位覆盖，每个主要顾虑至少被一个图位回应。',
    '8. 不允许生成泛泛的漂亮图片。高级、专业、8K、干净、高转化等词只能作为风格补充，必须绑定具体卖点、用户收益和画面证据。',
    '9. 图1白底图按 skill 规则：纯白或接近纯白背景，完整展示产品，不添加任何画面文案、标题、副标题、标签、贴纸、促销元素。国内平台可保留自然柔和落地投影，Amazon/跨境白底无投影；但产品关键部件、轮廓和用途线索必须清楚。',
    '10. 图2场景图按 skill 规则：单一完整使用场景铺满画面，产品为第一视觉中心，必须承接最强场景利益或最强购买理由；采用少字大字，默认只放 1 个主标题 + 最多 3 个短标签，不强制副标题；主标题中文≤8字，短标签中文≤4字。',
    '11. 图3卖点图按 skill 规则：只讲 1 个最重要购买理由，必须有视觉证据，如真实部位、使用动作、光效路径、局部小窗、前后对比或场景状态；采用少字大字，只放 1 个主标题 + 1 个核心卖点标签，主标题中文≤8字，标签中文≤4字。',
    '12. 图4功能说明图按 skill 规则：只讲 1 个功能/结构/用法，且不能和图3重复；引线、局部放大、结构小窗必须对应真实可见部位或真实信息，信息模块最多 2 个；采用少字大字，只放 1 个主标题 + 最多 2 个短功能标签，不写密集说明。',
    '13. 图5细节特写图按 skill 规则：建立品质信任，展示真实可见细节，可用微距、局部小窗、多角度拼图或放大镜；不得生成不存在的材质、接口、纹理或结构；默认取消统一主副标题，只保留 2-3 个图框内短标签，每个标签中文≤4字。',
    '14. 必须使用通用主图排版决策规律：先判断商品决策类型、卖点证据类型和信息密度，再选择版式骨架。数据库里的工具、食品、数码、穿戴样本只作为参考例子，不得硬套固定类目模板，也不得把所有商品都生成成白底极简图。',
    '15. 5 张图需统一主体、风格、色温、光影、配色、字体、背景基底和平台调性；一图一重点，不重复堆叠。',
    '16. 每条 prompt 必须按对应参考文件的字段结构输出，包含 [主图-N]、[氛围风格]、[画质]、[元素]、[光影]、[配色]、[视角构图]、[文字版式]，每条 260-480 字左右，中文正文；[文字版式] 必须明确少字、大字、无小字说明、无长句、无密集参数。',
    '',
    '通用主图排版决策规律（必须内化到规划和 prompt）：',
    'A. 先做四个判断：商品决策类型、卖点证据类型、信息密度、平台倾向。商品决策类型包括外观识别型、功能证明型、场景体验型、成分/口感/质地型、规格价值型、信任细节型、穿戴适配型。',
    'B. 卖点证据类型包括产品实物证据、使用过程证据、结果对比证据、局部细节证据、场景适配证据、数量规格证据、情绪/生活方式证据。每个卖点必须至少绑定一种可见证据。',
    'C. 信息密度按购买决策选择：低密度适合高价外观识别、精品配饰、品牌感商品；中密度适合大多数主图；高密度适合功能解释、低价流量、规格价值、工具耗材等需要快速说明的商品。',
    'D. 可选版式骨架：完整识别骨架、场景证明骨架、卖点聚焦骨架、功能机制骨架、细节信任骨架、规格价值骨架、对比结果骨架、穿戴适配骨架。每张图只能选择最适合的 1-2 个骨架，不要把所有模块堆满。',
    'E. 数据库样本只作为可迁移例子：工具类常用高密度功能证明；食品常用包装+质地+暖色食欲；数码高价品常用低密度外观识别；穿戴品常用佩戴/表盘/底部利益条。遇到其他商品时必须按商品真实决策类型重新选择版式。',
    'F. 每张图必须写出版式骨架的位置关系：产品主体区、卖点证据区、文字阅读区、辅助模块区如何分布；文字和标签必须避让产品关键结构、包装、食物纹理、脸部、屏幕和关键动作。',
    'G. 中文文案越多越容易乱码，默认只保留能影响点击的关键字。不要生成长标题、长副标题、参数列表、三行以上文字、密集小字、蚂蚁字、说明书式段落。宁可少字，也不要为了信息完整而堆字。',
    '',
    '信息整理补全的结构要求：',
    '严格整理：产品名称、品类、核心卖点、功能说明、可见特征、使用场景、平台、语种、画面参考风格、参考版式倾向、动作/道具建议、合规边界/信息缺口。',
    '只整理事实和可保守推理的信息，不生成上图文案，不输出占位词。',
    '',
    '主图设计规划的结构要求：',
    '先输出「上架卖点矩阵」3-6 行，字段用 ｜ 连接：卖点、用户顾虑、画面证明、建议图位、建议文案。建议文案必须极短，中文标题≤8字，短标签≤4字。',
    '再按 5 个图位各输出 1 行，字段用 ｜ 连接：实际图位类型、覆盖卖点、回应顾虑、视觉证据、核心视觉、展示视角、背景/风格、人物/道具建议、平台要求、品类策略、排版策略、版式骨架、版式/文字排版、画面文案。',
    '国内平台真实清晰；淘宝/天猫重品质材质；具体视觉风格必须由商品类型、卖点证据和平台倾向决定，不要默认成某一个固定类目。',
    '',
    '5 个 prompt 的图位字段要求：',
    '图1｜白底图：字段为 [主图-1] [氛围风格] [画质] [元素] [光影] [配色] [视角构图] [文字版式]；文字版式必须明确无任何画面文案。',
    '图2｜场景图：字段为 [主图-2] [氛围风格] [画质] [元素] [光影] [配色] [视角构图] [文字版式]；文字版式必须写出 1 个主标题和最多 3 条短标签，默认不写副标题。',
    '图3｜卖点图：字段为 [主图-3] [氛围风格] [画质] [元素] [光影] [配色] [视角构图] [文字版式]；文字版式必须写出 1 个主标题和 1 个核心卖点标签，默认不写副标题。',
    '图4｜功能说明图：字段为 [主图-4] [氛围风格] [画质] [元素] [光影] [配色] [视角构图] [文字版式]；功能点不得重复图3，文字版式只写 1 个主标题和最多 2 个短功能标签。',
    '图5｜细节特写图：字段为 [主图-5] [氛围风格] [画质] [元素] [光影] [配色] [视角构图] [文字版式]；多细节时优先满版多角度拼图+2到3个图框内短标签，不写统一长标题。',
    '',
    '当前页面信息：',
    JSON.stringify({
      product: product || '',
      priceBand: '',
      platform: settings?.platform,
      country: settings?.country,
      language: settings?.language,
      ratio: settings?.ratio,
      baseText,
    }, null, 2),
    '',
    '只输出 JSON，不要 Markdown，不要解释。JSON 结构如下：',
    JSON.stringify({
      information: '按 ecommerce-main-image-generator skill 的信息整理补全格式输出',
      plan: '按 ecommerce-main-image-generator skill 的主图设计规划格式输出，先给上架卖点矩阵，再给5行图位规划；每个图位需写明排版策略和版式骨架',
      prompts: [
        { id: 'image-1', name: '图1｜白底图', type: '白底图', prompt: '[主图-1]...[氛围风格]...[画质]...[元素]...[光影]...[配色]...[视角构图]...[文字版式]...' },
        { id: 'image-2', name: '图2｜场景图', type: '场景图', prompt: '[主图-2]...[氛围风格]...[画质]...[元素]...[光影]...[配色]...[视角构图]...[文字版式]...' },
        { id: 'image-3', name: '图3｜卖点图', type: '卖点图', prompt: '[主图-3]...[氛围风格]...[画质]...[元素]...[光影]...[配色]...[视角构图]...[文字版式]...' },
        { id: 'image-4', name: '图4｜功能说明图', type: '功能说明图', prompt: '[主图-4]...[氛围风格]...[画质]...[元素]...[光影]...[配色]...[视角构图]...[文字版式]...' },
        { id: 'image-5', name: '图5｜细节特写图', type: '细节特写图', prompt: '[主图-5]...[氛围风格]...[画质]...[元素]...[光影]...[配色]...[视角构图]...[文字版式]...' },
      ],
    }, null, 2),
  ].join('\n')
}

export async function expandProductSetPrompts({ product, priceBand, settings, baseText, image }) {
  loadLocalEnv()
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) throw new Error('缺少 ARK_API_KEY，请先在竞品报告页保存豆包 Ark 配置。')
  const cleanBaseText = String(baseText || '').trim()
  if (!cleanBaseText) throw new Error('请先选择商品价格段或填写基础生图文本')

  const content = [
    { type: 'input_text', text: buildExpansionInstruction({ product, priceBand, settings, baseText: cleanBaseText }) },
  ]
  const cleanImage = String(image || '').trim()
  if (cleanImage) content.push({ type: 'input_image', image_url: cleanImage })

  const response = await fetch(ARK_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_ANALYSIS_MODEL,
      input: [{ role: 'user', content }],
      max_output_tokens: 7500,
    }),
  })

  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { raw }
  }
  if (!response.ok) {
    throw new Error(`豆包 Ark 提示词扩写失败（HTTP ${response.status}）：${raw}`)
  }

  const text = extractResponseText(payload)
  const json = parseJsonFromText(text)
  return {
    ...normalizePromptPayload(json),
    model: payload.model || DEFAULT_ANALYSIS_MODEL,
    usage: payload.usage || null,
  }
}
