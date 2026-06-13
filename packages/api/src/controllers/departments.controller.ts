import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ManageDepartmentsUseCase } from '@hrms/core/usecases/manage-departments.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { ConflictError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { toDeptDTO } from '../mappers/employee.mapper'

const createDeptSchema = z.object({ name: z.string().min(1).max(100) })

export function createDepartmentsController(deptUseCase: ManageDepartmentsUseCase) {
  const router = new Hono()

  router.use('*', authMiddleware)
  router.use('*', requirePermission(AppModule.EMPLOYEES, 'canView'))

  router.get('/', async (c) => {
    const depts = await deptUseCase.listDepartments()
    return c.json(depts.map(toDeptDTO))
  })

  router.post('/', requirePermission(AppModule.EMPLOYEES, 'canCreate'), zValidator('json', createDeptSchema), async (c) => {
    const { name } = c.req.valid('json')
    try {
      const dept = await deptUseCase.createDepartment(name)
      return c.json(toDeptDTO(dept), 201)
    } catch (err) {
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      throw err
    }
  })

  return router
}
