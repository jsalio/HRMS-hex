import { Hono } from 'hono'
import { logger } from 'hono/logger'
import {
  loginUseCase, refreshTokenUseCase,
  listRolesUseCase, createRoleUseCase, updateRoleUseCase, deleteRoleUseCase,
  listEmployeesUseCase, getEmployeeUseCase, createEmployeeUseCase, updateEmployeeUseCase,
  terminateEmployeeUseCase, getEmployeeOnboardingUseCase, updateOnboardingStepUseCase,
  listDepartmentsUseCase, createDepartmentUseCase,
  listDocumentsUseCase, getDocumentUseCase, createDocumentUseCase, signDocumentUseCase,
  archiveDocumentUseCase, renewDocumentUseCase, listExpiringDocumentsUseCase,
  listAbsenceTypesUseCase, listAbsenceBalancesUseCase, listAbsenceRequestsUseCase,
  requestAbsenceUseCase, approveAbsenceUseCase, rejectAbsenceUseCase, cancelAbsenceUseCase,
  listAttendanceRecordsUseCase, getAttendanceSummaryUseCase, checkInUseCase,
  checkOutUseCase, editAttendanceRecordUseCase,
  listBenefitPlansUseCase, createBenefitPlanUseCase, updateBenefitPlanUseCase,
  getEmployeeBenefitsUseCase, enrollBenefitUseCase, unenrollBenefitUseCase,
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

const app = new Hono()

app.use('*', logger())

app.route('/auth',        createAuthController(loginUseCase, refreshTokenUseCase, refreshTokenRepo, tokenSvc))
app.route('/roles',       createRolesController(listRolesUseCase, createRoleUseCase, updateRoleUseCase, deleteRoleUseCase))
app.route('/employees',   createEmployeesController(
  listEmployeesUseCase, getEmployeeUseCase, createEmployeeUseCase, updateEmployeeUseCase,
  terminateEmployeeUseCase, getEmployeeOnboardingUseCase, updateOnboardingStepUseCase,
))
app.route('/departments', createDepartmentsController(listDepartmentsUseCase, createDepartmentUseCase))

const docsCtrl = createDocumentsController(
  listDocumentsUseCase, getDocumentUseCase, createDocumentUseCase, signDocumentUseCase,
  archiveDocumentUseCase, renewDocumentUseCase, listExpiringDocumentsUseCase,
)
app.route('/employees', docsCtrl.employeeRoutes)
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

const benefitsCtrl = createBenefitsController(
  listBenefitPlansUseCase, createBenefitPlanUseCase, updateBenefitPlanUseCase,
  getEmployeeBenefitsUseCase, enrollBenefitUseCase, unenrollBenefitUseCase,
)
app.route('/benefit-plans', benefitsCtrl.planRoutes)
app.route('/employees',     benefitsCtrl.enrollmentRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = Number(process.env.PORT ?? 3000)
console.log(`HRMS API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
