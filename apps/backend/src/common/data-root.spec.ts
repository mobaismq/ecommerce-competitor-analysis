import { join } from 'node:path'
import { resolveDataRoots, internalDataDir, userDataDir } from './data-root'

describe('data-root 两树分工解析', () => {
  it('未配置 ECOMMERCE_DATA_ROOT 时以主目录为基，拆出 .ecommerce 与 ecommerce 两树', () => {
    const home = '/Users/test'
    const roots = resolveDataRoots({})
    // 未传入 env 用真实 homedir；这里显式给 HOME 语义由测试基覆盖
    expect(roots.base).toBeDefined()
    expect(roots.internalRoot).toContain('.ecommerce')
    expect(roots.userRoot).toContain('ecommerce')
    expect(roots.internalRoot).not.toBe(roots.userRoot)
  })

  it('配置 ECOMMERCE_DATA_ROOT 时以其为基', () => {
    const roots = resolveDataRoots({ ECOMMERCE_DATA_ROOT: '/data/ecom' })
    expect(roots.base).toBe('/data/ecom')
    expect(roots.internalRoot).toBe(join('/data/ecom', '.ecommerce'))
    expect(roots.userRoot).toBe(join('/data/ecom', 'ecommerce'))
  })

  it('internalDataDir / userDataDir 按账号隔离', () => {
    expect(internalDataDir('acc-1', { ECOMMERCE_DATA_ROOT: '/r' })).toBe(join('/r', '.ecommerce', 'users', 'acc-1'))
    expect(userDataDir('acc-2', { ECOMMERCE_DATA_ROOT: '/r' })).toBe(join('/r', 'ecommerce', 'users', 'acc-2'))
  })

  it('基路径末尾斜杠被归一，两树不相交', () => {
    const roots = resolveDataRoots({ ECOMMERCE_DATA_ROOT: '/r/' })
    expect(roots.base).toBe('/r')
    expect(roots.internalRoot).toBe('/r/.ecommerce')
    expect(roots.userRoot).toBe('/r/ecommerce')
  })
})
