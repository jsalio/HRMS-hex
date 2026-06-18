import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListAttendanceRecordsUseCase } from '@hrms/core/usecases/list-attendance-records.usecase'
import type { GetAttendanceSummaryUseCase } from '@hrms/core/usecases/get-attendance-summary.usecase'
import type { CheckInUseCase } from '@hrms/core/usecases/check-in.usecase'
import type { CheckOutUseCase } from '@hrms/core/usecases/check-out.usecase'
import type { EditAttendanceRecordUseCase } from '@hrms/core/usecases/edit-attendance-record.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { NotFoundError, ValidationError, ConflictError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'

const ISO_TS = z.string().datetime({ message: 'Expected ISO 8601 timestamp' })

const checkInSchema  = z.object({ employee_id: z.string().uuid(), timestamp: ISO_TS })
const checkOutSchema = z.object({ employee_id: z.string().uuid(), timestamp: ISO_TS })

const editSchema = z.object({
  check_in:  ISO_TS.optional(),
  check_out: ISO_TS.optional(),
  status:    z.enum(['PRESENT','ABSENT','LATE','ON_LEAVE','HOLIDAY']).optional(),
  notes:     z.string().max(500).optional(),
})

function handleError(c: any, err: unknown) {
  if (err instanceof ConflictError)   return c.json({ error: err.message }, 409)
  if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
  if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
  throw err
}

/**
 * Builds the `/attendance` router, wiring each HTTP route to its atomic use case.
 *
 * @param listRecords - use case that returns a paginated list of attendance records
 * @param getSummary - use case that computes an employee's attendance summary
 * @param checkIn - use case that registers an employee check-in
 * @param checkOut - use case that registers an employee check-out
 * @param editRecord - use case that applies manual corrections to a record
 * @returns a Hono router protected by authentication and ATTENDANCE permissions
 */
export function createAttendanceController(
  listRecords: ListAttendanceRecordsUseCase,
  getSummary: GetAttendanceSummaryUseCase,
  checkIn: CheckInUseCase,
  checkOut: CheckOutUseCase,
  editRecord: EditAttendanceRecordUseCase,
) {
  const app = new Hono()
  app.use('*', authMiddleware)

  // GET /attendance
  app.get('/', requirePermission(AppModule.ATTENDANCE, 'canView'), async c => {
    const q = c.req.query()
    const result = await listRecords.execute({
      employeeId: q.employee_id,
      status:     q.status as any,
      from:       q.from,
      to:         q.to,
      page:       q.page  ? Number(q.page)  : 1,
      limit:      q.limit ? Math.min(Number(q.limit), 100) : 20,
    })
    return c.json(result)
  })

  // GET /attendance/summary
  app.get('/summary', requirePermission(AppModule.ATTENDANCE, 'canView'), async c => {
    const { employee_id, from, to } = c.req.query()
    if (!employee_id || !from || !to) {
      return c.json({ error: 'employee_id, from and to are required' }, 422)
    }
    const summary = await getSummary.execute(employee_id, from, to)
    return c.json(summary)
  })

  // POST /attendance/check-in
  app.post('/check-in', requirePermission(AppModule.ATTENDANCE, 'canCreate'), zValidator('json', checkInSchema), async c => {
    const { employee_id, timestamp } = c.req.valid('json')
    try {
      const record = await checkIn.execute(employee_id, new Date(timestamp))
      return c.json(record, 201)
    } catch (err) { return handleError(c, err) }
  })

  // POST /attendance/check-out
  app.post('/check-out', requirePermission(AppModule.ATTENDANCE, 'canCreate'), zValidator('json', checkOutSchema), async c => {
    const { employee_id, timestamp } = c.req.valid('json')
    try {
      const record = await checkOut.execute(employee_id, new Date(timestamp))
      return c.json(record)
    } catch (err) { return handleError(c, err) }
  })

  // PATCH /attendance/:id
  app.patch('/:id', requirePermission(AppModule.ATTENDANCE, 'canEdit'), zValidator('json', editSchema), async c => {
    const body = c.req.valid('json')
    try {
      const record = await editRecord.execute(c.req.param('id'), {
        checkIn:  body.check_in  ? new Date(body.check_in)  : undefined,
        checkOut: body.check_out ? new Date(body.check_out) : undefined,
        status:   body.status,
        notes:    body.notes,
      })
      return c.json(record)
    } catch (err) { return handleError(c, err) }
  })

  return app
}
