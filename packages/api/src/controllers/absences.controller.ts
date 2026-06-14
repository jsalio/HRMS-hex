import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ManageAbsencesUseCase } from '@hrms/core/usecases/manage-absences.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { NotFoundError, ValidationError, UnauthorizedError } from '@hrms/core'
import type { AuthenticatedUser } from '@hrms/core/contracts/auth'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const createRequestSchema = z.object({
  employeeId:    z.string().uuid(),
  absenceTypeId: z.string().uuid(),
  startDate:     z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD'),
  endDate:       z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD'),
  reason:        z.string().max(500).optional(),
})

const approveSchema = z.object({
  notes: z.string().max(500).optional(),
})

const rejectSchema = z.object({
  notes: z.string().min(1).max(500),
})

function isManager(user: AuthenticatedUser): boolean {
  return user.role.name === 'super_admin' || user.role.name === 'hr_manager'
}

function handleError(c: any, err: unknown) {
  if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
  if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
  if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 403)
  throw err
}

export function createAbsencesController(uc: ManageAbsencesUseCase) {
  const app = new Hono()
  app.use('*', authMiddleware)

  // GET /absence-types — public to all authenticated
  app.get('/absence-types', async c => {
    const types = await uc.listAbsenceTypes()
    return c.json(types)
  })

  // GET /employees/:id/absence-balances?year
  app.get(
    '/employees/:id/absence-balances',
    requirePermission(AppModule.ABSENCES, 'canView'),
    async c => {
      const employeeId = c.req.param('id')
      const year = Number(c.req.query('year') ?? new Date().getFullYear())
      const balances = await uc.listBalances(employeeId, year)
      return c.json(balances)
    }
  )

  // GET /absence-requests
  app.get(
    '/absence-requests',
    requirePermission(AppModule.ABSENCES, 'canView'),
    async c => {
      const q = c.req.query()
      const result = await uc.listRequests({
        employeeId: q.employee_id,
        status:     q.status as any,
        from:       q.from,
        to:         q.to,
        page:       q.page ? Number(q.page) : 1,
        limit:      q.limit ? Math.min(Number(q.limit), 100) : 20,
      })
      return c.json(result)
    }
  )

  // POST /absence-requests
  app.post(
    '/absence-requests',
    requirePermission(AppModule.ABSENCES, 'canCreate'),
    zValidator('json', createRequestSchema),
    async c => {
      const user = c.get('user') as AuthenticatedUser
      const body = c.req.valid('json')
      try {
        const request = await uc.requestAbsence({ ...body, requesterId: user.id })
        return c.json(request, 201)
      } catch (err) {
        return handleError(c, err)
      }
    }
  )

  // PATCH /absence-requests/:id/approve
  app.patch(
    '/absence-requests/:id/approve',
    requirePermission(AppModule.ABSENCES, 'canEdit'),
    zValidator('json', approveSchema),
    async c => {
      const user = c.get('user') as AuthenticatedUser
      if (!isManager(user)) return c.json({ error: 'Forbidden' }, 403)
      const body = c.req.valid('json')
      try {
        const request = await uc.approveAbsence(c.req.param('id'), user.id, body.notes)
        return c.json(request)
      } catch (err) {
        return handleError(c, err)
      }
    }
  )

  // PATCH /absence-requests/:id/reject
  app.patch(
    '/absence-requests/:id/reject',
    requirePermission(AppModule.ABSENCES, 'canEdit'),
    zValidator('json', rejectSchema),
    async c => {
      const user = c.get('user') as AuthenticatedUser
      if (!isManager(user)) return c.json({ error: 'Forbidden' }, 403)
      const body = c.req.valid('json')
      try {
        const request = await uc.rejectAbsence(c.req.param('id'), user.id, body.notes)
        return c.json(request)
      } catch (err) {
        return handleError(c, err)
      }
    }
  )

  // PATCH /absence-requests/:id/cancel
  app.patch(
    '/absence-requests/:id/cancel',
    requirePermission(AppModule.ABSENCES, 'canView'),
    async c => {
      const user = c.get('user') as AuthenticatedUser
      try {
        const request = await uc.cancelAbsence(c.req.param('id'), user.id)
        return c.json(request)
      } catch (err) {
        return handleError(c, err)
      }
    }
  )

  return app
}
