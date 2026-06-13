import { sql } from '@hrms/boundary-postgres'
import {
  UserRepository, RoleRepository, RefreshTokenRepository,
  EmployeeRepository, DepartmentRepository,
} from '@hrms/boundary-postgres'
import {
  LoginUseCase, RefreshTokenUseCase, ManageRolesUseCase,
  ManageEmployeesUseCase, ManageDepartmentsUseCase,
} from '@hrms/core'
import { JwtTokenService } from './services/jwt-token.service'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required')

// Repositories (adapters)
const userRepo         = new UserRepository(sql)
const roleRepo         = new RoleRepository(sql)
const refreshTokenRepo = new RefreshTokenRepository(sql)
const employeeRepo     = new EmployeeRepository(sql)
const deptRepo         = new DepartmentRepository(sql)

// Services
const tokenSvc = new JwtTokenService(jwtSecret)

// Use cases — auth
export const loginUseCase        = new LoginUseCase(userRepo, roleRepo, tokenSvc, refreshTokenRepo)
export const refreshTokenUseCase = new RefreshTokenUseCase(refreshTokenRepo, userRepo, tokenSvc, roleRepo)
export const manageRolesUseCase  = new ManageRolesUseCase(roleRepo)

// Use cases — employees
export const manageEmployeesUseCase   = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo)
export const manageDepartmentsUseCase = new ManageDepartmentsUseCase(deptRepo)

// Expose repos needed by controllers
export { refreshTokenRepo, tokenSvc }
