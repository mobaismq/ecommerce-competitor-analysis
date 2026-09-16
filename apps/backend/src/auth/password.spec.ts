import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  describe('hashPassword', () => {
    it('以 salt:hash 格式存储', () => {
      const stored = hashPassword('secret123')
      const [salt, hash] = stored.split(':')
      expect(salt).toHaveLength(32) // 16 字节 hex
      expect(hash).toHaveLength(128) // 64 字节 hex
    })

    it('每次生成随机 salt，同密码两次结果不同', () => {
      expect(hashPassword('x')).not.toEqual(hashPassword('x'))
    })
  })

  describe('verifyPassword', () => {
    it('正确密码可通过校验', () => {
      const stored = hashPassword('correct-horse')
      expect(verifyPassword('correct-horse', stored)).toBe(true)
    })

    it('错误密码校验失败', () => {
      const stored = hashPassword('correct-horse')
      expect(verifyPassword('wrong-password', stored)).toBe(false)
    })

    it('空密码校验失败', () => {
      const stored = hashPassword('abc')
      expect(verifyPassword('', stored)).toBe(false)
    })

    it('格式非法的存储串返回 false', () => {
      expect(verifyPassword('x', 'no-separator')).toBe(false)
      expect(verifyPassword('x', '')).toBe(false)
      expect(verifyPassword('x', 'single')).toBe(false)
    })
  })
})