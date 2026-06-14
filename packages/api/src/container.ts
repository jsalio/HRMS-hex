import { sql } from '@hrms/boundary-postgres'
import {
  UserRepository, RoleRepository, RefreshTokenRepository,
  EmployeeRepository, DepartmentRepository, DocumentRepository,
  AbsenceRepository, AttendanceRepository,
} from '@hrms/boundary-postgres'
import {
  LoginUseCase, RefreshTokenUseCase, ManageRolesUseCase,
  ManageEmployeesUseCase, ManageDepartmentsUseCase, ManageDocumentsUseCase,
  ManageAbsencesUseCase, ManageAttendanceUseCase,
} from '@hrms/core'
import { JwtTokenService } from './services/jwt-token.service'
import { BunPasswordService } from './services/bun-password.service'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required')

// Repositories (adapters)
const userRepo         = new UserRepository(sql)
const roleRepo         = new RoleRepository(sql)
const refreshTokenRepo = new RefreshTokenRepository(sql)
const employeeRepo     = new EmployeeRepository(sql)
const deptRepo         = new DepartmentRepository(sql)
const documentRepo     = new DocumentRepository(sql)
const absenceRepo      = new AbsenceRepository(sql)
const attendanceRepo   = new AttendanceRepository(sql)

// Services
const tokenSvc    = new JwtTokenService(jwtSecret)
const passwordSvc = new BunPasswordService()

// Use cases — auth
export const loginUseCase        = new LoginUseCase(userRepo, roleRepo, tokenSvc, refreshTokenRepo, passwordSvc)
export const refreshTokenUseCase = new RefreshTokenUseCase(refreshTokenRepo, userRepo, tokenSvc, roleRepo)
export const manageRolesUseCase  = new ManageRolesUseCase(roleRepo)

// Use cases — employees
export const manageEmployeesUseCase   = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)
export const manageDepartmentsUseCase = new ManageDepartmentsUseCase(deptRepo)
export const manageDocumentsUseCase   = new ManageDocumentsUseCase(documentRepo, employeeRepo)
export const manageAbsencesUseCase    = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
export const manageAttendanceUseCase  = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)

// Expose repos needed by controllers
export { refreshTokenRepo, tokenSvc }
