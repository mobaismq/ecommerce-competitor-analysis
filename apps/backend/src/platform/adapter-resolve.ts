/** 解析平台 code 对应的适配器注册码：已注册则用原码，tmall 回落 taobao，其余回落 mock。 */
export function resolveAdapterCode(code: string, registered: string[]): string {
  const c = code.toLowerCase()
  if (registered.includes(c)) return c
  if (c === 'tmall') return 'taobao'
  return 'mock'
}