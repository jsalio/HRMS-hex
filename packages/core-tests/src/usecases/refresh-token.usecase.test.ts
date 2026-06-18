import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { RefreshTokenUseCase } from '@hrms/core/usecases/refresh-token.usecase'
import { User } from '@hrms/core/domain/user'
import { Role } from '@hrms/core/domain/role'
import { UnauthorizedError } from '@hrms/core/domain/errors'
import type { IUserRepository, ITokenService, IRefreshTokenRepository, StoredRefreshToken } from '@hrms/core/contracts/auth'
import type { IRoleRepository } from '@hrms/core/contracts/roles'

const activeUser = new User({ id: 'u1', email: 'a@b.com', passwordHash: 'h', isActive: true, roleId: 'r1' })
const fakeRole = new Role({ id: 'r1', name: 'hr_manager', isSystem: true, permissions: [] })

function makeRoleRepo(): IRoleRepository {
  return {
    findAll: mock(() => Promise.resolve([fakeRole])),
    findById: mock(() => Promise.resolve(fakeRole)),
    findByName: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(fakeRole)),
    update: mock(() => Promise.resolve(fakeRole)),
    delete: mock(() => Promise.resolve()),
  }
}

const validStoredToken: StoredRefreshToken = {
  id: 'rt-1',
  userId: 'u1',
  tokenHash: 'hashed:raw-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
}

function makeTokenRepo(overrides: Partial<IRefreshTokenRepository> = {}): IRefreshTokenRepository {
  return {
    create: mock(() => Promise.resolve()),
    findByHash: mock(() => Promise.resolve(validStoredToken)),
    revoke: mock(() => Promise.resolve()),
    revokeAllForUser: mock(() => Promise.resolve()),
    ...overrides,
  }
}

function makeUserRepo(): IUserRepository {
  return {
    findByEmail: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(activeUser)),
    create: mock(() => Promise.resolve(activeUser)),
    deactivate: mock(() => Promise.resolve(activeUser)),
    setEmployee: mock(() => Promise.resolve()),
    updateLastLogin: mock(() => Promise.resolve()),
  }
}

function makeTokenSvc(): ITokenService {
  return {
    generateAccessToken: mock(() => Promise.resolve('new.access.token')),
    verifyAccessToken: mock(() => ({ id: 'u1', email: 'a@b.com', role: { id: 'r1', name: 'hr_manager', permissions: [] } })),
    generateRefreshToken: mock(() => 'new-raw-refresh'),
    hashToken: mock((t: string) => `hashed:${t}`),
  }
}

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase

  beforeEach(() => {
    useCase = new RefreshTokenUseCase(makeTokenRepo(), makeUserRepo(), makeTokenSvc(), makeRoleRepo())
  })

  // Test 2.7
  it('given_valid_refresh_token_when_execute_then_returns_new_access_token', async () => {
    const result = await useCase.execute({ refreshToken: 'raw-token' })
    expect(result.access_token).toBe('new.access.token')
    expect(result.refresh_token).toBe('new-raw-refresh')
  })

  // Test 2.8
  it('given_valid_refresh_token_when_execute_then_old_token_is_revoked_and_new_one_created', async () => {
    const tokenRepo = makeTokenRepo()
    const uc = new RefreshTokenUseCase(tokenRepo, makeUserRepo(), makeTokenSvc(), makeRoleRepo())
    await uc.execute({ refreshToken: 'raw-token' })
    expect(tokenRepo.revoke).toHaveBeenCalledWith('rt-1')
    expect(tokenRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' })
    )
  })

  // Test 2.9
  it('given_expired_refresh_token_when_execute_then_throws_UnauthorizedError', async () => {
    const expiredToken: StoredRefreshToken = { ...validStoredToken, expiresAt: new Date(Date.now() - 1000) }
    const tokenRepo = makeTokenRepo({ findByHash: mock(() => Promise.resolve(expiredToken)) })
    const uc = new RefreshTokenUseCase(tokenRepo, makeUserRepo(), makeTokenSvc(), makeRoleRepo())
    await expect(uc.execute({ refreshToken: 'raw-token' })).rejects.toThrow(UnauthorizedError)
  })

  // Test 2.10
  it('given_revoked_refresh_token_when_execute_then_throws_UnauthorizedError', async () => {
    const revokedToken: StoredRefreshToken = { ...validStoredToken, revokedAt: new Date() }
    const tokenRepo = makeTokenRepo({ findByHash: mock(() => Promise.resolve(revokedToken)) })
    const uc = new RefreshTokenUseCase(tokenRepo, makeUserRepo(), makeTokenSvc(), makeRoleRepo())
    await expect(uc.execute({ refreshToken: 'raw-token' })).rejects.toThrow(UnauthorizedError)
  })
})
