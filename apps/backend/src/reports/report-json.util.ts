/**
 * 从模型/文本响应中提取合法 JSON 对象（去除 ```json 代码块包裹）。
 * AI 返回非 JSON 时返回 null，调用方按"宁缺勿假"退化为诚实空态。
 */
export function extractJson(text?: string): Record<string, any> | null {
  if (!text) return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}