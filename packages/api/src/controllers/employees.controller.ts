import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ManageEmployeesUseCase } from '@hrms/core/usecases/manage-employees.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { ConflictError, NotFoundError, ValidationError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import {
  toEmployeeSummaryDTO, toEmployeeDetailDTO, toOnboardingDTO,
} from '../mappers/employee.mapper'

const ONBOARDING_STEP = z.enum(['documents', 'equipment', 'training', 'access', 'complete'])
const EMPLOYEE_STATUS = z.enum(['ACTIVE', 'REMOTE', 'ON_LEAVE'])

const createEmployeeSchema = z.object({
  fullName:       z.string().min(1).max(255),
  documentId:     z.string().min(1).max(50),
  corporateEmail: z.string().email(),
  departmentId:   z.string().uuid(),
  jobTitle:       z.string().min(1).max(100),
  salary:         z.number().positive(),
  hireDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

const updateEmployeeSchema = z.object({
  fullName:     z.string().min(1).max(255).optional(),
  departmentId: z.string().uuid().optional(),
  jobTitle:     z.string().min(1).max(100).optional(),
  salary:       z.number().positive().optional(),
  status:       EMPLOYEE_STATUS.optional(),
})

const terminateSchema = z.object({
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

const updateOnboardingSchema = z.object({
  completed: z.boolean(),
  notes:     z.string().max(500).optional(),
})

export function createEmployeesController(employeesUseCase: ManageEmployeesUseCase) {
  const router = new Hono()

  router.use('*', authMiddleware)
  router.use('*', requirePermission(AppModule.EMPLOYEES, 'canView'))

  // GET /employees?department_id&status&search&page&limit
  router.get('/', async (c) => {
    const q = c.req.query()
    const result = await employeesUseCase.listEmployees({
      departmentId: q.department_id,
      status:       q.status as any,
      search:       q.search,
      page:         q.page  ? Number(q.page)  : undefined,
      limit:        q.limit ? Number(q.limit) : undefined,
    })
    return c.json({
      data: result.data.map(toEmployeeSummaryDTO),
      total: result.total,
      page: result.page,
    })
  })

  // POST /employees
  router.post('/', requirePermission(AppModule.EMPLOYEES, 'canCreate'), zValidator('json', createEmployeeSchema), async (c) => {
    const body = c.req.valid('json')
    try {
      const employee = await employeesUseCase.createEmployee(body)
      return c.json(toEmployeeDetailDTO(employee), 201)
    } catch (err) {
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      throw err
    }
  })

  // GET /employees/:id
  router.get('/:id', async (c) => {
    try {
      const employee = await employeesUseCase.getEmployee(c.req.param('id'))
      return c.json(toEmployeeDetailDTO(employee))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      throw err
    }
  })

  // PATCH /employees/:id
  router.patch('/:id', requirePermission(AppModule.EMPLOYEES, 'canEdit'), zValidator('json', updateEmployeeSchema), async (c) => {
    const body = c.req.valid('json')
    try {
      const employee = await employeesUseCase.updateEmployee(c.req.param('id'), body)
      return c.json(toEmployeeSummaryDTO(employee))
    } catch (err) {
      if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
      if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
      if (err instanceof ConflictError)   return c.json({ error: err.message }, 409)
      throw err
    }
  })

  // POST /employees/:id/terminate
  router.post('/:id/terminate', requirePermission(AppModule.EMPLOYEES, 'canEdit'), zValidator('json', terminateSchema), async (c) => {
    const { terminationDate } = c.req.valid('json')
    try {
      const employee = await employeesUseCase.terminateEmployee(
        c.req.param('id'),
        new Date(terminationDate),
      )
      return c.json(toEmployeeSummaryDTO(employee))
    } catch (err) {
      if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
      if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
      throw err
    }
  })

  // GET /employees/:id/onboarding
  router.get('/:id/onboarding', async (c) => {
    try {
      const steps = await employeesUseCase.getOnboarding(c.req.param('id'))
      return c.json(steps.map(toOnboardingDTO))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      throw err
    }
  })

  // PATCH /employees/:id/onboarding/:step
  router.patch('/:id/onboarding/:step', requirePermission(AppModule.EMPLOYEES, 'canEdit'), zValidator('json', updateOnboardingSchema), async (c) => {
    const { id, step } = c.req.param()
    const parsed = ONBOARDING_STEP.safeParse(step)
    if (!parsed.success) return c.json({ error: `Invalid step: ${step}` }, 400)

    const { completed, notes } = c.req.valid('json')
    try {
      const onboarding = await employeesUseCase.updateOnboardingStep(id, parsed.data, completed, notes)
      return c.json(toOnboardingDTO(onboarding))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      throw err
    }
  })

  return router
}
