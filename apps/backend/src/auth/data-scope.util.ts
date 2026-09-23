/**
 * dataScope 语义兼容（对照旧版 accountManagement.js 数字 dataScope + migrateDataScope）。
 * 旧版：0全部 / 1部门 / 2自己（可能以数字字符串或数字存储）；新版：'all' / 'department' / 'self'。
 * 读取侧统一归一化为字符串，保证 guard 与 user.service 的 === 比较对历史数据也成立。
 */
export function normalizeDataScope(value: unknown): 'all' | 'department' | 'self' {
  if (value === '0' || value === 0 || value === 'all') return 'all'
  if (value === '1' || value === 1 || value === 'department' || value === 'dept') return 'department'
  if (value === '2' || value === 2 || value === 'self') return 'self'
  return 'all'
}