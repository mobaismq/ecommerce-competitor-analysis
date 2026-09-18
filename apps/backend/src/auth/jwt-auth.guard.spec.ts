import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from './jwt-auth.guard'

function makeContext(headers: Record<string, string | undefined>): { context: ExecutionContext; request: any } {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = { headers }
  const context = {
    getHandler: () => ({} as never),
    getClass: () => ({} as never),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { context, request }
}

describe('JwtAuthGuard', () => {
  it('未注入 JwtService 时能够安全构造并降级实例化', () => {
    const guard = new JwtAuthGuard()
    expect(guard).toBeDefined()
  })

  it('没有 Authorization 头或非 Bearer 时抛出 UnauthorizedException', async () => {
    const guard = new JwtAuthGuard()
    const { context } = makeContext({})
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)

    const { context: context2 } = makeContext({ authorization: 'Basic 123' })
    await expect(guard.canActivate(context2)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('Token 验证成功时将 payload 附加到 request.user 并放行', async () => {
    const fakeJwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', username: 'test' }),
    } as unknown as JwtService

    const guard = new JwtAuthGuard(fakeJwtService)
    const { context, request } = makeContext({ authorization: 'Bearer valid-token' })

    const result = await guard.canActivate(context)
    expect(result).toBe(true)
    expect(request.user).toEqual({ sub: 'user-1', username: 'test' })
    expect(fakeJwtService.verifyAsync).toHaveBeenCalledWith('valid-token')
  })

  it('Token 验证失败时抛出 UnauthorizedException', async () => {
    const fakeJwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
    } as unknown as JwtService

    const guard = new JwtAuthGuard(fakeJwtService)
    const { context } = makeContext({ authorization: 'Bearer expired-token' })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
