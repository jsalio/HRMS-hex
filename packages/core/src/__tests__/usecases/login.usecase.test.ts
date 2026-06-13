import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { LoginUseCase } from '../../usecases/login.usecase'
import { User } from '../../domain/user'
import { Role } from '../../domain/role'
import { AppModule } from '../../contracts/roles'
import { UnauthorizedError } from '../../domain/errors'
import type { IUserRepository, ITokenService, IRefreshTokenRepository, IPasswordService } from '../../contracts/auth'
import type { IRoleRepository } from '../../contracts/roles'

const VALID_PASSWORD = 'secret123'
const FAKE_HASH = 'hashed:secret123'

const fakeRole = new Role({
  id: 'role-1',
  name: 'hr_manager',
  isSystem: true,
  permissions: [
    { module: AppModule.EMPLOYEES, canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false },
  ],
})

const fakeUser = new User({
  id: 'user-1',
  email: 'hr@acme.com',
  passwordHash: FAKE_HASH,
  isActive: true,
  roleId: 'role-1',
})

const inactiveUser = new User({
  id: 'u2',
  email: 'hr@acme.com',
  passwordHash: FAKE_HASH,
  isActive: false,
  roleId: 'role-1',
})

function makeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findByEmail: mock(() => Promise.resolve(fakeUser)),
    findById: mock(() => Promise.resolve(fakeUser)),
    create: mock(() => Promise.resolve(fakeUser)),
    deactivate: mock(() => Promise.resolve(fakeUser)),
    setEmployee: mock(() => Promise.resolve()),
    updateLastLogin: mock(() => Promise.resolve()),
    ...overrides,
  }
}

function makeRoleRepo(overrides: Partial<IRoleRepository> = {}): IRoleRepository {
  return {
    findAll: mock(() => Promise.resolve([fakeRole])),
    findById: mock(() => Promise.resolve(fakeRole)),
    findByName: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(fakeRole)),
    update: mock(() => Promise.resolve(fakeRole)),
    delete: mock(() => Promise.resolve()),
    ...overrides,
  }
}

function makeTokenSvc(): ITokenService {
  return {
    generateAccessToken: mock(() => Promise.resolve('access.token.here')),
    verifyAccessToken: mock(() => ({ id: 'user-1', email: 'hr@acme.com', role: { id: 'role-1', name: 'hr_manager', permissions: [] } })),
    generateRefreshToken: mock(() => 'raw-refresh-token'),
    hashToken: mock((t: string) => `hashed:${t}`),
  }
}

function makeTokenRepo(): IRefreshTokenRepository {
  return {
    create: mock(() => Promise.resolve()),
    findByHash: mock(() => Promise.resolve(null)),
    revoke: mock(() => Promise.resolve()),
    revokeAllForUser: mock(() => Promise.resolve()),
  }
}

function makePasswordSvc(validPassword = VALID_PASSWORD): IPasswordService {
  return {
    hash: mock((p: string) => Promise.resolve(`hashed:${p}`)),
    verify: mock((password: string) => Promise.resolve(password === validPassword)),
  }
}

describe('LoginUseCase', () => {
  let useCase: LoginUseCase

  beforeEach(() => {
    useCase = new LoginUseCase(makeUserRepo(), makeRoleRepo(), makeTokenSvc(), makeTokenRepo(), makePasswordSvc())
  })

  // Test 2.1
  it('given_valid_credentials_when_execute_then_returns_tokens_and_user', async () => {
    const result = await useCase.execute({ email: 'hr@acme.com', password: VALID_PASSWORD })
    expect(result.access_token).toBe('access.token.here')
    expect(result.refresh_token).toBe('raw-refresh-token')
    expect(result.user.id).toBe('user-1')
    expect(result.user.email).toBe('hr@acme.com')
  })

  // Test 2.2 — frozen contract shape
  it('given_valid_login_when_execute_then_AuthenticatedUser_has_exact_contract_shape', async () => {
    const result = await useCase.execute({ email: 'hr@acme.com', password: VALID_PASSWORD })
    expect(result.user).toHaveProperty('id')
    expect(result.user).toHaveProperty('email')
    expect(result.user).toHaveProperty('role')
    expect(result.user.role).toHaveProperty('id')
    expect(result.user.role).toHaveProperty('name')
    expect(result.user.role).toHaveProperty('permissions')
    expect(Array.isArray(result.user.role.permissions)).toBe(true)
    if (result.user.role.permissions.length > 0) {
      const perm = result.user.role.permissions[0]!
      expect(perm).toHaveProperty('module')
      expect(perm).toHaveProperty('canView')
      expect(perm).toHaveProperty('canCreate')
      expect(perm).toHaveProperty('canEdit')
      expect(perm).toHaveProperty('canDelete')
      expect(perm).toHaveProperty('canExport')
    }
  })

  // Test 2.3
  it('given_invalid_password_when_execute_then_throws_UnauthorizedError', async () => {
    await expect(useCase.execute({ email: 'hr@acme.com', password: 'wrong' })).rejects.toThrow(UnauthorizedError)
  })

  // Test 2.4
  it('given_unknown_email_when_execute_then_throws_UnauthorizedError', async () => {
    const userRepo = makeUserRepo({ findByEmail: mock(() => Promise.resolve(null)) })
    const uc = new LoginUseCase(userRepo, makeRoleRepo(), makeTokenSvc(), makeTokenRepo(), makePasswordSvc())
    await expect(uc.execute({ email: 'unknown@x.com', password: 'any' })).rejects.toThrow(UnauthorizedError)
  })

  // Test 2.5
  it('given_inactive_user_when_execute_then_throws_UnauthorizedError', async () => {
    const userRepo = makeUserRepo({ findByEmail: mock(() => Promise.resolve(inactiveUser)) })
    const uc = new LoginUseCase(userRepo, makeRoleRepo(), makeTokenSvc(), makeTokenRepo(), makePasswordSvc())
    await expect(uc.execute({ email: 'hr@acme.com', password: VALID_PASSWORD })).rejects.toThrow(UnauthorizedError)
  })

  // Test 2.6
  it('given_valid_login_when_execute_then_refresh_token_is_stored', async () => {
    const tokenRepo = makeTokenRepo()
    const uc = new LoginUseCase(makeUserRepo(), makeRoleRepo(), makeTokenSvc(), tokenRepo, makePasswordSvc())
    await uc.execute({ email: 'hr@acme.com', password: VALID_PASSWORD })
    expect(tokenRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    )
  })
})
