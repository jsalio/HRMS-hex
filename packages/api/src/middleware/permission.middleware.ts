import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { AppModule, RolePermission } from '@hrms/core/contracts/roles'
import type { AuthenticatedUser } from '@hrms/core/contracts/auth'

// FROZEN CONTRACT — signature used by all sub-specs
export function requirePermission(module: AppModule, action: keyof Omit<RolePermission, 'module'>) {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('user') as AuthenticatedUser | undefined
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const perm = user.role.permissions.find(p => p.module === module)
    const allowed = perm?.[action] === true

    if (!allowed) return c.json({ error: 'Forbidden' }, 403)
    await next()
  })
}
