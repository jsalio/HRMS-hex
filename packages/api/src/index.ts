import { Hono } from 'hono'
import { logger } from 'hono/logger'
import {
  loginUseCase, refreshTokenUseCase, manageRolesUseCase,
  manageEmployeesUseCase, manageDepartmentsUseCase,
  refreshTokenRepo, tokenSvc,
} from './container'
import { createAuthController } from './controllers/auth.controller'
import { createRolesController } from './controllers/roles.controller'
import { createEmployeesController } from './controllers/employees.controller'
import { createDepartmentsController } from './controllers/departments.controller'

const app = new Hono()

app.use('*', logger())

app.route('/auth',        createAuthController(loginUseCase, refreshTokenUseCase, refreshTokenRepo, tokenSvc))
app.route('/roles',       createRolesController(manageRolesUseCase))
app.route('/employees',   createEmployeesController(manageEmployeesUseCase))
app.route('/departments', createDepartmentsController(manageDepartmentsUseCase))

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = Number(process.env.PORT ?? 3000)
console.log(`HRMS API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
