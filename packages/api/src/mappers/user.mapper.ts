import type { AuthenticatedUser } from '@hrms/core/contracts/auth'
import type { Role } from '@hrms/core/domain/role'
import type { User } from '@hrms/core/domain/user'

export function toAuthenticatedUser(user: User, role: Role): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    role: {
      id: role.id,
      name: role.name,
      permissions: role.toAuthPermissions(),
    },
  }
}
