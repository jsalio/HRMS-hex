import { sql } from '@hrms/boundary-postgres'
import {
  UserRepository, RoleRepository, RefreshTokenRepository,
  EmployeeRepository, DepartmentRepository, DocumentRepository,
  AbsenceRepository, AttendanceRepository, BenefitRepository,
  RecruitmentRepository,
} from '@hrms/boundary-postgres'
import {
  LoginUseCase, RefreshTokenUseCase,
  ListRolesUseCase, CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase,
  ListEmployeesUseCase, GetEmployeeUseCase, CreateEmployeeUseCase, UpdateEmployeeUseCase,
  TerminateEmployeeUseCase, GetEmployeeOnboardingUseCase, UpdateOnboardingStepUseCase,
  ListDepartmentsUseCase, CreateDepartmentUseCase,
  ListDocumentsUseCase, GetDocumentUseCase, CreateDocumentUseCase, SignDocumentUseCase,
  ArchiveDocumentUseCase, RenewDocumentUseCase, ListExpiringDocumentsUseCase,
  ListAbsenceTypesUseCase, ListAbsenceBalancesUseCase, ListAbsenceRequestsUseCase,
  RequestAbsenceUseCase, ApproveAbsenceUseCase, RejectAbsenceUseCase, CancelAbsenceUseCase,
  ListAttendanceRecordsUseCase, GetAttendanceSummaryUseCase, CheckInUseCase,
  CheckOutUseCase, EditAttendanceRecordUseCase,
  ListBenefitPlansUseCase, CreateBenefitPlanUseCase, UpdateBenefitPlanUseCase,
  GetEmployeeBenefitsUseCase, EnrollBenefitUseCase, UnenrollBenefitUseCase,
  ListJobPostingsUseCase, CreateJobPostingUseCase, UpdateJobPostingUseCase,
  ListCandidatesUseCase, GetCandidateUseCase, CreateCandidateUseCase,
  AdvanceCandidateStatusUseCase, HireCandidateUseCase,
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
const benefitRepo      = new BenefitRepository(sql)
const recruitmentRepo  = new RecruitmentRepository(sql)

// Services
const tokenSvc    = new JwtTokenService(jwtSecret)
const passwordSvc = new BunPasswordService()

// Use cases — auth
export const loginUseCase        = new LoginUseCase(userRepo, roleRepo, tokenSvc, refreshTokenRepo, passwordSvc)
export const refreshTokenUseCase = new RefreshTokenUseCase(refreshTokenRepo, userRepo, tokenSvc, roleRepo)
export const listRolesUseCase    = new ListRolesUseCase(roleRepo)
export const createRoleUseCase   = new CreateRoleUseCase(roleRepo)
export const updateRoleUseCase   = new UpdateRoleUseCase(roleRepo)
export const deleteRoleUseCase   = new DeleteRoleUseCase(roleRepo)

// Use cases — employees
export const listEmployeesUseCase       = new ListEmployeesUseCase(employeeRepo)
export const getEmployeeUseCase          = new GetEmployeeUseCase(employeeRepo)
export const createEmployeeUseCase       = new CreateEmployeeUseCase(employeeRepo, deptRepo, userRepo, roleRepo, passwordSvc)
export const updateEmployeeUseCase       = new UpdateEmployeeUseCase(employeeRepo, deptRepo)
export const terminateEmployeeUseCase    = new TerminateEmployeeUseCase(employeeRepo, userRepo, refreshTokenRepo)
export const getEmployeeOnboardingUseCase = new GetEmployeeOnboardingUseCase(employeeRepo)
export const updateOnboardingStepUseCase = new UpdateOnboardingStepUseCase(employeeRepo)

// Use cases — departments
export const listDepartmentsUseCase  = new ListDepartmentsUseCase(deptRepo)
export const createDepartmentUseCase = new CreateDepartmentUseCase(deptRepo)

// Use cases — documents
export const listDocumentsUseCase         = new ListDocumentsUseCase(documentRepo)
export const getDocumentUseCase           = new GetDocumentUseCase(documentRepo)
export const createDocumentUseCase        = new CreateDocumentUseCase(documentRepo, employeeRepo)
export const signDocumentUseCase          = new SignDocumentUseCase(documentRepo)
export const archiveDocumentUseCase       = new ArchiveDocumentUseCase(documentRepo)
export const renewDocumentUseCase         = new RenewDocumentUseCase(documentRepo)
export const listExpiringDocumentsUseCase = new ListExpiringDocumentsUseCase(documentRepo)

// Use cases — absences
export const listAbsenceTypesUseCase    = new ListAbsenceTypesUseCase(absenceRepo)
export const listAbsenceBalancesUseCase = new ListAbsenceBalancesUseCase(absenceRepo)
export const listAbsenceRequestsUseCase = new ListAbsenceRequestsUseCase(absenceRepo)
export const requestAbsenceUseCase      = new RequestAbsenceUseCase(absenceRepo, employeeRepo)
export const approveAbsenceUseCase      = new ApproveAbsenceUseCase(absenceRepo)
export const rejectAbsenceUseCase       = new RejectAbsenceUseCase(absenceRepo)
export const cancelAbsenceUseCase       = new CancelAbsenceUseCase(absenceRepo)

// Use cases — attendance
export const listAttendanceRecordsUseCase = new ListAttendanceRecordsUseCase(attendanceRepo)
export const getAttendanceSummaryUseCase  = new GetAttendanceSummaryUseCase(attendanceRepo)
export const checkInUseCase               = new CheckInUseCase(attendanceRepo, employeeRepo)
export const checkOutUseCase              = new CheckOutUseCase(attendanceRepo)
export const editAttendanceRecordUseCase  = new EditAttendanceRecordUseCase(attendanceRepo)

// Use cases — benefits
export const listBenefitPlansUseCase    = new ListBenefitPlansUseCase(benefitRepo)
export const createBenefitPlanUseCase   = new CreateBenefitPlanUseCase(benefitRepo)
export const updateBenefitPlanUseCase   = new UpdateBenefitPlanUseCase(benefitRepo)
export const getEmployeeBenefitsUseCase = new GetEmployeeBenefitsUseCase(benefitRepo)
export const enrollBenefitUseCase       = new EnrollBenefitUseCase(benefitRepo)
export const unenrollBenefitUseCase     = new UnenrollBenefitUseCase(benefitRepo)

// Use cases — recruitment
export const listJobPostingsUseCase         = new ListJobPostingsUseCase(recruitmentRepo)
export const createJobPostingUseCase        = new CreateJobPostingUseCase(recruitmentRepo, deptRepo)
export const updateJobPostingUseCase        = new UpdateJobPostingUseCase(recruitmentRepo)
export const listCandidatesUseCase          = new ListCandidatesUseCase(recruitmentRepo)
export const getCandidateUseCase            = new GetCandidateUseCase(recruitmentRepo)
export const createCandidateUseCase         = new CreateCandidateUseCase(recruitmentRepo)
export const advanceCandidateStatusUseCase  = new AdvanceCandidateStatusUseCase(recruitmentRepo)
export const hireCandidateUseCase           = new HireCandidateUseCase(recruitmentRepo)

// Expose repos needed by controllers
export { refreshTokenRepo, tokenSvc }
