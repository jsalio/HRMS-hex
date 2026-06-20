import { Hono } from 'hono'
import { logger } from 'hono/logger'
import {
  loginUseCase, refreshTokenUseCase,
  listRolesUseCase, createRoleUseCase, updateRoleUseCase, deleteRoleUseCase,
  listEmployeesUseCase, getEmployeeUseCase, createEmployeeUseCase, updateEmployeeUseCase,
  terminateEmployeeUseCase, getEmployeeOnboardingUseCase, updateOnboardingStepUseCase,
  listDepartmentsUseCase, createDepartmentUseCase, updateDepartmentUseCase, deleteDepartmentUseCase,
  listDocumentsUseCase, getDocumentUseCase, createDocumentUseCase, signDocumentUseCase,
  archiveDocumentUseCase, renewDocumentUseCase, listExpiringDocumentsUseCase,
  listAbsenceTypesUseCase, listAbsenceBalancesUseCase, listAbsenceRequestsUseCase,
  requestAbsenceUseCase, approveAbsenceUseCase, rejectAbsenceUseCase, cancelAbsenceUseCase,
  listAttendanceRecordsUseCase, getAttendanceSummaryUseCase, checkInUseCase,
  checkOutUseCase, editAttendanceRecordUseCase,
  listBenefitPlansUseCase, createBenefitPlanUseCase, updateBenefitPlanUseCase,
  getEmployeeBenefitsUseCase, enrollBenefitUseCase, unenrollBenefitUseCase,
  listJobPostingsUseCase, createJobPostingUseCase, updateJobPostingUseCase,
  listCandidatesUseCase, getCandidateUseCase, createCandidateUseCase,
  advanceCandidateStatusUseCase, hireCandidateUseCase,
  refreshTokenRepo, tokenSvc,
} from './container'
import { createAuthController } from './controllers/auth.controller'
import { createRolesController } from './controllers/roles.controller'
import { createEmployeesController } from './controllers/employees.controller'
import { createDepartmentsController } from './controllers/departments.controller'
import { createDocumentsController } from './controllers/documents.controller'
import { createAbsencesController } from './controllers/absences.controller'
import { createAttendanceController } from './controllers/attendance.controller'
import { createBenefitsController } from './controllers/benefits.controller'
import { createRecruitmentController } from './controllers/recruitment.controller'

const app = new Hono()

app.use('*', logger())

app.route('/auth',        createAuthController(loginUseCase, refreshTokenUseCase, refreshTokenRepo, tokenSvc))
app.route('/roles',       createRolesController(listRolesUseCase, createRoleUseCase, updateRoleUseCase, deleteRoleUseCase))
app.route('/departments', createDepartmentsController(
  listDepartmentsUseCase, createDepartmentUseCase,
  updateDepartmentUseCase, deleteDepartmentUseCase,
))

const docsCtrl = createDocumentsController(
  listDocumentsUseCase, getDocumentUseCase, createDocumentUseCase, signDocumentUseCase,
  archiveDocumentUseCase, renewDocumentUseCase, listExpiringDocumentsUseCase,
)

const benefitsCtrl = createBenefitsController(
  listBenefitPlansUseCase, createBenefitPlanUseCase, updateBenefitPlanUseCase,
  getEmployeeBenefitsUseCase, enrollBenefitUseCase, unenrollBenefitUseCase,
)

// Sub-routers scoped to /employees must be registered BEFORE the employees controller
// because that controller applies a global requirePermission(EMPLOYEES, canView) middleware
// that would otherwise intercept routes owned by other modules (documents, benefits).
app.route('/employees', docsCtrl.employeeRoutes)
app.route('/employees', benefitsCtrl.enrollmentRoutes)
app.route('/employees', createEmployeesController(
  listEmployeesUseCase, getEmployeeUseCase, createEmployeeUseCase, updateEmployeeUseCase,
  terminateEmployeeUseCase, getEmployeeOnboardingUseCase, updateOnboardingStepUseCase,
))

app.route('/documents', docsCtrl.documentRoutes)

const absencesCtrl = createAbsencesController(
  listAbsenceTypesUseCase, listAbsenceBalancesUseCase, listAbsenceRequestsUseCase,
  requestAbsenceUseCase, approveAbsenceUseCase, rejectAbsenceUseCase, cancelAbsenceUseCase,
)
app.route('/', absencesCtrl)

app.route('/attendance', createAttendanceController(
  listAttendanceRecordsUseCase, getAttendanceSummaryUseCase, checkInUseCase,
  checkOutUseCase, editAttendanceRecordUseCase,
))

app.route('/benefit-plans', benefitsCtrl.planRoutes)

const recruitmentCtrl = createRecruitmentController(
  listJobPostingsUseCase, createJobPostingUseCase, updateJobPostingUseCase,
  listCandidatesUseCase, getCandidateUseCase, createCandidateUseCase,
  advanceCandidateStatusUseCase, hireCandidateUseCase,
)
app.route('/job-postings', recruitmentCtrl.jobPostingRoutes)
app.route('/candidates',   recruitmentCtrl.candidateRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = Number(process.env.PORT ?? 3000)
console.log(`HRMS API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
