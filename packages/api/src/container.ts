import { sql } from '@hrms/boundary-postgres'
import { UserRepository, RoleRepository, RefreshTokenRepository } from '@hrms/boundary-postgres'
import { LoginUseCase, RefreshTokenUseCase, ManageRolesUseCase } from '@hrms/core'
import { JwtTokenService } from './services/jwt-token.service'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required')

// Repositories (adapters)
const userRepo         = new UserRepository(sql)
const roleRepo         = new RoleRepository(sql)
const refreshTokenRepo = new RefreshTokenRepository(sql)

// Services
const tokenSvc = new JwtTokenService(jwtSecret)

// Use cases
export const loginUseCase        = new LoginUseCase(userRepo, roleRepo, tokenSvc, refreshTokenRepo)
export const refreshTokenUseCase = new RefreshTokenUseCase(refreshTokenRepo, userRepo, tokenSvc)
export const manageRolesUseCase  = new ManageRolesUseCase(roleRepo)

// Expose repos needed by controllers
export { refreshTokenRepo, tokenSvc }
