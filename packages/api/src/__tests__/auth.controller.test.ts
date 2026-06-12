import { describe, it, expect, mock } from 'bun:test'
import { Hono } from 'hono'
import { createAuthController } from '../controllers/auth.controller'
import type { LoginUseCase } from '@hrms/core/usecases/login.usecase'
import type { RefreshTokenUseCase } from '@hrms/core/usecases/refresh-token.usecase'
import type { IRefreshTokenRepository, ITokenService } from '@hrms/core/contracts/auth'
import { UnauthorizedError } from '@hrms/core'

const fakeUser = {
  id: 'u1',
  email: 'test@hrms.com',
  role: { id: 'r1', name: 'hr_manager', permissions: [] },
}

function buildApp(overrides: {
  loginResult?: object
  loginError?: Error
  refreshResult?: object
  refreshError?: Error
}) {
  const loginUseCase = {
    execute: mock(() => overrides.loginError
      ? Promise.reject(overrides.loginError)
      : Promise.resolve(overrides.loginResult ?? { access_token: 'at', refresh_token: 'rt', user: fakeUser })
    ),
  } as unknown as LoginUseCase

  const refreshUseCase = {
    execute: mock(() => overrides.refreshError
      ? Promise.reject(overrides.refreshError)
      : Promise.resolve(overrides.refreshResult ?? { access_token: 'new-at', refresh_token: 'new-rt' })
    ),
  } as unknown as RefreshTokenUseCase

  const tokenRepo: IRefreshTokenRepository = {
    create: mock(() => Promise.resolve()),
    findByHash: mock(() => Promise.resolve(null)),
    revoke: mock(() => Promise.resolve()),
    revokeAllForUser: mock(() => Promise.resolve()),
  }

  const tokenSvc: ITokenService = {
    generateAccessToken: mock(() => 'at'),
    verifyAccessToken: mock(() => fakeUser),
    generateRefreshToken: mock(() => 'rt'),
    hashToken: mock((t: string) => `h:${t}`),
  }

  const app = new Hono()
  app.route('/auth', createAuthController(loginUseCase, refreshUseCase, tokenRepo, tokenSvc))
  return app
}

describe('AuthController', () => {
  // Test 4.1
  it('given_valid_credentials_when_POST_auth_login_then_returns_200_with_tokens_and_user', async () => {
    const app = buildApp({})
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@hrms.com', password: 'secret' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('access_token')
    expect(body).toHaveProperty('refresh_token')
    expect(body).toHaveProperty('user')
  })

  // Test 4.2
  it('given_invalid_credentials_when_POST_auth_login_then_returns_401', async () => {
    const app = buildApp({ loginError: new UnauthorizedError() })
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@hrms.com', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  // Test 4.3
  it('given_valid_refresh_token_when_POST_auth_refresh_then_returns_200_with_new_access_token', async () => {
    const app = buildApp({})
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'valid-rt' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('access_token')
  })

  // Test 4.4
  it('given_expired_token_when_POST_auth_refresh_then_returns_401', async () => {
    const app = buildApp({ refreshError: new UnauthorizedError('Expired') })
    const res = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'expired-rt' }),
    })
    expect(res.status).toBe(401)
  })

  // Test 4.9
  it('given_request_without_authorization_header_when_POST_logout_then_returns_401', async () => {
    const app = buildApp({})
    const res = await app.request('/auth/logout', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
