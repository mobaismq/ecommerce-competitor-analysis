import {
  DEFAULT_SLOT_CONFIGS,
  DETAIL_MODULE_ORDER,
  normalizeRequestedPromptSlots,
  normalizeDetailPromptSlots,
  normalizeGeneratedImagePrompts,
  normalizeSelectedSlots,
  normalizeRetouchIntent,
  normalizeRetouchReferenceMode,
  parseJsonFromText,
  buildWorkflowInformationPrompt,
  buildWorkflowDesignPlanPrompt,
  buildImagePromptGenerationPrompt,
  buildDetailImagePromptGenerationPrompt,
  buildImageRetouchPromptGenerationPrompt,
  buildFallbackRetouchPrompt,
} from './image-prompt'

describe('image-prompt（迁移自旧 mainImagePromptExpansion）', () => {
  describe('配置常量', () => {
    it('主图默认 5 图位', () => {
      expect(DEFAULT_SLOT_CONFIGS).toHaveLength(5)
      expect(DEFAULT_SLOT_CONFIGS[0].type).toBe('白底图')
    })

    it('详情图模块顺序为 16 项且含首屏主视觉', () => {
      expect(DETAIL_MODULE_ORDER).toHaveLength(16)
      expect(DETAIL_MODULE_ORDER[0]).toBe('首屏主视觉')
    })
  })

  describe('parseJsonFromText', () => {
    it('剥离 Markdown 代码块并解析 JSON', () => {
      const result = parseJsonFromText('```json\n{"information":"内容"}\n```')
      expect(result?.information).toBe('内容')
    })

    it('无法解析时返回 null', () => {
      expect(parseJsonFromText('不是 JSON')).toBeNull()
    })
  })

  describe('normalizeRequestedPromptSlots', () => {
    it('过滤非法类型，保留合法图位并按序编号', () => {
      const slots = normalizeRequestedPromptSlots([
        { type: '白底图' },
        { type: '非法类型' },
        { type: '场景图', sequence: 3 },
      ])
      expect(slots).toHaveLength(2)
      expect(slots[0].type).toBe('白底图')
      expect(slots[1].sequence).toBe(3)
    })
  })

  describe('normalizeDetailPromptSlots', () => {
    it('容忍斜杠/下划线差异并按模块顺序返回', () => {
      const slots = normalizeDetailPromptSlots(['尺寸/容量/尺码图', '尺寸_容量_尺码图', '首屏主视觉'])
      expect(slots.map((s) => s.type)).toEqual(['首屏主视觉', '尺寸/容量/尺码图'])
    })

    it('去重重复模块', () => {
      const slots = normalizeDetailPromptSlots(['使用场景图', '使用场景图'])
      expect(slots).toHaveLength(1)
    })
  })

  describe('normalizeGeneratedImagePrompts', () => {
    it('按请求图位对齐模型返回的 prompt，并过滤空 prompt', () => {
      const promptSlots = [
        { id: 'image-1', name: '图1｜白底图', type: '白底图', sequence: 1 },
        { id: 'image-2', name: '图2｜场景图', type: '场景图', sequence: 2 },
      ]
      const json = { prompts: [{ id: 'image-1', prompt: '白底提示词' }, { id: 'image-2', prompt: '' }] }
      const result = normalizeGeneratedImagePrompts(json, promptSlots)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('image-1')
      expect(result[0].prompt).toBe('白底提示词')
    })
  })

  describe('normalizeSelectedSlots', () => {
    it('只保留合法图位 id，按默认顺序返回', () => {
      const result = normalizeSelectedSlots(['image-3', 'image-1', 'nonexistent'])
      expect(result.map((s) => s.id)).toEqual(['image-1', 'image-3'])
    })
  })

  describe('normalizeRetouchIntent / ReferenceMode', () => {
    it('非法 intent 回退 retouch', () => {
      expect(normalizeRetouchIntent('bogus')).toBe('retouch')
      expect(normalizeRetouchIntent('product_fix')).toBe('product_fix')
    })

    it('retouch/text_edit 默认 current_only，其余默认 product_and_current', () => {
      expect(normalizeRetouchReferenceMode('', 'retouch')).toBe('current_only')
      expect(normalizeRetouchReferenceMode('', 'style_scene')).toBe('product_and_current')
    })
  })

  describe('主图提示词模板', () => {
    const settings = { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' }

    it('buildWorkflowInformationPrompt 输出含信息整理与平台设置', () => {
      const prompt = buildWorkflowInformationPrompt({ settings, baseText: '便携榨汁杯' }, '/nonexistent-spec-dir')
      expect(prompt).toContain('主图生图工作流第2步')
      expect(prompt).toContain('便携榨汁杯')
      expect(prompt).toContain('淘宝')
    })

    it('buildImagePromptGenerationPrompt 输出各图位 JSON 骨架与类型规则', () => {
      const slots = normalizeRequestedPromptSlots([{ type: '白底图' }, { type: '场景图' }])
      const prompt = buildImagePromptGenerationPrompt({ settings, information: '信息', designPlan: '规划', promptSlots: slots }, '/nonexistent-spec-dir')
      expect(prompt).toContain('工作流第4步')
      expect(prompt).toContain('"id": "image-prompt-1"')
      expect(prompt).toContain('白底图')
      // spec 文件缺失时应回退到内联规则
      expect(prompt).toContain('纯白或接近纯白背景')
    })

    it('buildWorkflowDesignPlanPrompt 按本次图位规划', () => {
      const slots = normalizeRequestedPromptSlots([{ type: '卖点图' }])
      const prompt = buildWorkflowDesignPlanPrompt({ settings, information: '信息', promptSlots: slots }, '/nonexistent-spec-dir')
      expect(prompt).toContain('工作流第3步')
      expect(prompt).toContain('卖点图')
    })
  })

  describe('详情图提示词模板', () => {
    const settings = { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' }

    it('buildDetailImagePromptGenerationPrompt 按模块输出，缺失 spec 用默认口径', () => {
      const slots = normalizeDetailPromptSlots(['首屏主视觉', '核心卖点图'])
      const prompt = buildDetailImagePromptGenerationPrompt({ settings, information: '信息', designPlan: '规划', promptSlots: slots }, '/nonexistent-spec-dir')
      expect(prompt).toContain('工作流第4步')
      expect(prompt).toContain('首屏主视觉')
      expect(prompt).toContain('核心卖点图')
    })
  })

  describe('AI 改图提示词', () => {
    it('buildImageRetouchPromptGenerationPrompt 输出 intent 与参考图优先级', () => {
      const prompt = buildImageRetouchPromptGenerationPrompt({ slot: { name: '图1｜白底图', type: '白底图' }, userDirection: '把背景换掉' })
      expect(prompt).toContain('AI改图专用提示词')
      expect(prompt).toContain('把背景换掉')
      expect(prompt).toContain('intent')
    })

    it('buildFallbackRetouchPrompt 生成纯文本回退', () => {
      const prompt = buildFallbackRetouchPrompt({ slot: { name: '图3', type: '卖点图' } })
      expect(prompt).toContain('电商图片定向改图')
      expect(prompt).toContain('图3')
    })
  })
})
