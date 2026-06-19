import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListBenefitPlansUseCase } from '@hrms/core/usecases/list-benefit-plans.usecase'
import type { CreateBenefitPlanUseCase } from '@hrms/core/usecases/create-benefit-plan.usecase'
import type { UpdateBenefitPlanUseCase } from '@hrms/core/usecases/update-benefit-plan.usecase'
import type { GetEmployeeBenefitsUseCase } from '@hrms/core/usecases/get-employee-benefits.usecase'
import type { EnrollBenefitUseCase } from '@hrms/core/usecases/enroll-benefit.usecase'
import type { UnenrollBenefitUseCase } from '@hrms/core/usecases/unenroll-benefit.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '@hrms/core'
import type { AuthenticatedUser } from '@hrms/core/contracts/auth'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const VALID_PLAN_TYPES = ['health', 'life_insurance', 'dental', 'vision', 'pension', 'other'] as const

const createPlanSchema = z.object({
  name:        z.string().min(1).max(100),
  type:        z.enum(VALID_PLAN_TYPES),
  description: z.string().max(1000).optional(),
  provider:    z.string().max(100).optional(),
  cost:        z.number().positive().optional(),
})

const updatePlanSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  type:        z.enum(VALID_PLAN_TYPES).optional(),
  description: z.string().max(1000).optional(),
  provider:    z.string().max(100).optional(),
  cost:        z.number().positive().optional(),
  isActive:    z.boolean().optional(),
})

const enrollSchema = z.object({
  plan_id:     z.string().uuid(),
  enrolled_at: z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD'),
})

function handleError(c: any, err: unknown) {
  if (err instanceof ForbiddenError)   return c.json({ error: err.message }, 403)
  if (err instanceof ValidationError)  return c.json({ error: err.message }, 422)
  if (err instanceof ConflictError)    return c.json({ error: err.message }, 409)
  if (err instanceof NotFoundError)    return c.json({ error: err.message }, 404)
  throw err
}

/**
 * Builds the benefits router, wiring each HTTP route to its atomic use case.
 *
 * @param listBenefitPlans - use case that returns all benefit plans
 * @param createBenefitPlan - use case that creates a new benefit plan
 * @param updateBenefitPlan - use case that updates an existing plan
 * @param getEmployeeBenefits - use case that returns an employee's enrollments
 * @param enrollBenefit - use case that enrolls an employee in a plan
 * @param unenrollBenefit - use case that unenrolls an employee from a plan
 * @returns a Hono router with two subrouters: /benefit-plans and /employees/:id/benefits
 */
export function createBenefitsController(
  listBenefitPlans:    ListBenefitPlansUseCase,
  createBenefitPlan:   CreateBenefitPlanUseCase,
  updateBenefitPlan:   UpdateBenefitPlanUseCase,
  getEmployeeBenefits: GetEmployeeBenefitsUseCase,
  enrollBenefit:       EnrollBenefitUseCase,
  unenrollBenefit:     UnenrollBenefitUseCase,
) {
  const plans = new Hono()
  plans.use('*', authMiddleware)

  // GET /benefit-plans — any authenticated user with canView
  plans.get('/', requirePermission(AppModule.BENEFITS, 'canView'), async c => {
    const result = await listBenefitPlans.execute()
    return c.json(result)
  })

  // POST /benefit-plans — hr_manager / super_admin with canCreate
  plans.post(
    '/',
    requirePermission(AppModule.BENEFITS, 'canCreate'),
    zValidator('json', createPlanSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const plan = await createBenefitPlan.execute(body)
        return c.json(plan, 201)
      } catch (err) { return handleError(c, err) }
    },
  )

  // PATCH /benefit-plans/:id — hr_manager / super_admin with canEdit
  plans.patch(
    '/:id',
    requirePermission(AppModule.BENEFITS, 'canEdit'),
    zValidator('json', updatePlanSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const plan = await updateBenefitPlan.execute(c.req.param('id'), body)
        return c.json(plan)
      } catch (err) { return handleError(c, err) }
    },
  )

  const enrollments = new Hono()
  enrollments.use('*', authMiddleware)

  // GET /employees/:id/benefits — canView, ownership enforced in use case
  enrollments.get(
    '/:id/benefits',
    requirePermission(AppModule.BENEFITS, 'canView'),
    async c => {
      try {
        const user = c.get('user') as AuthenticatedUser
        const benefits = await getEmployeeBenefits.execute({
          employeeId:        c.req.param('id'),
          requestingUserId:  user.id,
          requestingUserRole: user.role.name,
        })
        return c.json(benefits)
      } catch (err) { return handleError(c, err) }
    },
  )

  // POST /employees/:id/benefits — canCreate
  enrollments.post(
    '/:id/benefits',
    requirePermission(AppModule.BENEFITS, 'canCreate'),
    zValidator('json', enrollSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const enrollment = await enrollBenefit.execute({
          employeeId: c.req.param('id'),
          planId:     body.plan_id,
          enrolledAt: body.enrolled_at,
        })
        return c.json(enrollment, 201)
      } catch (err) { return handleError(c, err) }
    },
  )

  // DELETE /employees/:id/benefits/:planId — canEdit
  enrollments.delete(
    '/:id/benefits/:planId',
    requirePermission(AppModule.BENEFITS, 'canEdit'),
    async c => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const enrollment = await unenrollBenefit.execute({
          employeeId:  c.req.param('id'),
          planId:      c.req.param('planId'),
          unenrolledAt: today,
        })
        return c.json(enrollment)
      } catch (err) { return handleError(c, err) }
    },
  )

  return { planRoutes: plans, enrollmentRoutes: enrollments }
}
