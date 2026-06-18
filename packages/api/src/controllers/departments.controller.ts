import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListDepartmentsUseCase } from '@hrms/core/usecases/list-departments.usecase'
import type { CreateDepartmentUseCase } from '@hrms/core/usecases/create-department.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { ConflictError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { toDeptDTO } from '../mappers/employee.mapper'

const createDeptSchema = z.object({ name: z.string().min(1).max(100) })

/**
 * Builds the `/departments` router, wiring each HTTP route to its atomic use case.
 *
 * @param listDepartments - use case that returns the department catalogue
 * @param createDepartment - use case that creates a new department
 * @returns a Hono router protected by authentication and EMPLOYEES permissions
 */
export function createDepartmentsController(
  listDepartments: ListDepartmentsUseCase,
  createDepartment: CreateDepartmentUseCase,
) {
  const router = new Hono()

  router.use('*', authMiddleware)
  router.use('*', requirePermission(AppModule.EMPLOYEES, 'canView'))

  router.get('/', async (c) => {
    const depts = await listDepartments.execute()
    return c.json(depts.map(toDeptDTO))
  })

  router.post('/', requirePermission(AppModule.EMPLOYEES, 'canCreate'), zValidator('json', createDeptSchema), async (c) => {
    const { name } = c.req.valid('json')
    try {
      const dept = await createDepartment.execute(name)
      return c.json(toDeptDTO(dept), 201)
    } catch (err) {
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      throw err
    }
  })

  return router
}
