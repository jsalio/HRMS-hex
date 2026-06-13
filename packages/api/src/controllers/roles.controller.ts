import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ManageRolesUseCase } from '@hrms/core/usecases/manage-roles.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { DomainError, ConflictError, NotFoundError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { toRoleDTO } from '../mappers/role.mapper'

const permissionSchema = z.object({
  module: z.nativeEnum(AppModule),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canExport: z.boolean(),
})

const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(permissionSchema),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  permissions: z.array(permissionSchema).optional(),
})

export function createRolesController(manageRolesUseCase: ManageRolesUseCase) {
  const router = new Hono()

  router.use('*', authMiddleware)
  router.use('*', requirePermission(AppModule.SETTINGS, 'canView'))

  router.get('/', async (c) => {
    const roles = await manageRolesUseCase.listRoles()
    return c.json(roles.map(toRoleDTO))
  })

  router.post('/', requirePermission(AppModule.SETTINGS, 'canCreate'), zValidator('json', createRoleSchema), async (c) => {
    const body = c.req.valid('json')
    try {
      const role = await manageRolesUseCase.createRole(body)
      return c.json(toRoleDTO(role), 201)
    } catch (err) {
      if (err instanceof ConflictError) return c.json({ error: err.message }, 409)
      throw err
    }
  })

  router.put('/:id', requirePermission(AppModule.SETTINGS, 'canEdit'), zValidator('json', updateRoleSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    try {
      const role = await manageRolesUseCase.updateRole(id, body)
      return c.json(toRoleDTO(role))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      if (err instanceof DomainError) return c.json({ error: err.message }, 422)
      throw err
    }
  })

  router.delete('/:id', requirePermission(AppModule.SETTINGS, 'canDelete'), async (c) => {
    const id = c.req.param('id')
    try {
      await manageRolesUseCase.deleteRole(id)
      return c.body(null, 204)
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      if (err instanceof DomainError) return c.json({ error: err.message }, 422)
      throw err
    }
  })

  return router
}
