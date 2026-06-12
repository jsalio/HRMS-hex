import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { LoginUseCase } from '@hrms/core/usecases/login.usecase'
import type { RefreshTokenUseCase } from '@hrms/core/usecases/refresh-token.usecase'
import type { IRefreshTokenRepository } from '@hrms/core/contracts/auth'
import type { ITokenService } from '@hrms/core/contracts/auth'
import { UnauthorizedError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import type { AuthenticatedUser } from '@hrms/core/contracts/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
})

export function createAuthController(
  loginUseCase: LoginUseCase,
  refreshTokenUseCase: RefreshTokenUseCase,
  tokenRepo: IRefreshTokenRepository,
  tokenSvc: ITokenService,
) {
  const router = new Hono()

  router.post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    try {
      const result = await loginUseCase.execute({ email, password })
      return c.json(result, 200)
    } catch (err) {
      if (err instanceof UnauthorizedError) return c.json({ error: 'Unauthorized' }, 401)
      throw err
    }
  })

  router.post('/refresh', zValidator('json', refreshSchema), async (c) => {
    const { refresh_token } = c.req.valid('json')
    try {
      const result = await refreshTokenUseCase.execute({ refreshToken: refresh_token })
      return c.json(result, 200)
    } catch (err) {
      if (err instanceof UnauthorizedError) return c.json({ error: 'Unauthorized' }, 401)
      throw err
    }
  })

  router.post('/logout', authMiddleware, async (c) => {
    const user = c.get('user') as AuthenticatedUser
    await tokenRepo.revokeAllForUser(user.id)
    return c.body(null, 204)
  })

  return router
}
