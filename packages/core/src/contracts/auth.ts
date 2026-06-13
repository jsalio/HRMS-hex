import type { AppModule, RolePermission } from './roles'
import type { User } from '../domain/user'

// FROZEN CONTRACT — shape consumed by all sub-specs via JWT payload and API response
export interface AuthenticatedUser {
  id: string
  email: string
  role: {
    id: string
    name: string
    permissions: Array<{
      module: AppModule
      canView: boolean
      canCreate: boolean
      canEdit: boolean
      canDelete: boolean
      canExport: boolean
    }>
  }
}

export interface CreateUserData {
  email: string
  passwordHash: string
  roleId: string
  employeeId?: string
}

export interface StoredRefreshToken {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

export interface CreateRefreshTokenData {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserData): Promise<User>
  deactivate(id: string): Promise<User>
  setEmployee(userId: string, employeeId: string): Promise<void>
  updateLastLogin(userId: string): Promise<void>
}

export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<void>
  findByHash(hash: string): Promise<StoredRefreshToken | null>
  revoke(tokenId: string): Promise<void>
  revokeAllForUser(userId: string): Promise<void>
}

export interface ITokenService {
  generateAccessToken(user: AuthenticatedUser): Promise<string>
  verifyAccessToken(token: string): AuthenticatedUser
  generateRefreshToken(): string
  hashToken(token: string): string
}

export interface IPasswordService {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}
