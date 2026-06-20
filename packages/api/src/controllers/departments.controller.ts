import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListDepartmentsUseCase } from '@hrms/core/usecases/list-departments.usecase'
import type { CreateDepartmentUseCase } from '@hrms/core/usecases/create-department.usecase'
import type { UpdateDepartmentUseCase } from '@hrms/core/usecases/update-department.usecase'
import type { DeleteDepartmentUseCase } from '@hrms/core/usecases/delete-department.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { ConflictError, NotFoundError, ValidationError, DepartmentNotEmptyError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { toDeptDTO } from '../mappers/employee.mapper'

const deptNameSchema = z.object({ name: z.string().min(1).max(100) })

/**
 * Builds the `/departments` router, wiring each HTTP route to its atomic use case.
 *
 * @param listDepartments - use case that returns the department catalogue
 * @param createDepartment - use case that creates a new department
 * @param updateDepartment - use case that updates a department's name
 * @param deleteDepartment - use case that removes a department if it is empty
 * @returns a Hono router protected by authentication and EMPLOYEES permissions
 */
export function createDepartmentsController(
  listDepartments: ListDepartmentsUseCase,
  createDepartment: CreateDepartmentUseCase,
  updateDepartment: UpdateDepartmentUseCase,
  deleteDepartment: DeleteDepartmentUseCase,
) {
  const router = new Hono()

  router.use('*', authMiddleware)
  router.use('*', requirePermission(AppModule.EMPLOYEES, 'canView'))

  /**
   * GET /departments — returns the full department catalogue ordered by name.
   */
  router.get('/', async (c) => {
    const depts = await listDepartments.execute()
    return c.json(depts.map(toDeptDTO))
  })

  /**
   * POST /departments — creates a new department.
   * Requires EMPLOYEES canCreate permission.
   */
  router.post('/', requirePermission(AppModule.EMPLOYEES, 'canCreate'), zValidator('json', deptNameSchema), async (c) => {
    const { name } = c.req.valid('json')
    try {
      const dept = await createDepartment.execute(name)
      return c.json(toDeptDTO(dept), 201)
    } catch (err) {
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      throw err
    }
  })

  /**
   * PUT /departments/:id — updates the name of an existing department.
   * Requires EMPLOYEES canEdit permission.
   */
  router.put('/:id', requirePermission(AppModule.EMPLOYEES, 'canEdit'), zValidator('json', deptNameSchema), async (c) => {
    const id = c.req.param('id')
    const { name } = c.req.valid('json')
    try {
      const dept = await updateDepartment.execute(id, name)
      return c.json(toDeptDTO(dept))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
      throw err
    }
  })

  /**
   * DELETE /departments/:id — removes a department that has no active employees.
   * Requires EMPLOYEES canDelete permission.
   */
  router.delete('/:id', requirePermission(AppModule.EMPLOYEES, 'canDelete'), async (c) => {
    const id = c.req.param('id')
    try {
      await deleteDepartment.execute(id)
      return c.body(null, 204)
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      if (err instanceof DepartmentNotEmptyError) return c.json({ error: err.message }, 409)
      throw err
    }
  })

  return router
}
