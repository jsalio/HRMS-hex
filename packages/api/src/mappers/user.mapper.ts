import type { AuthenticatedUser } from '@hrms/core/contracts/auth'
import type { Role } from '@hrms/core/domain/role'
import type { User } from '@hrms/core/domain/user'

/**
 * Combines a domain user with its domain role into the authenticated user
 * shape used for tokens and authorisation, embedding the role's permission
 * matrix.
 *
 * @param user - domain user being authenticated
 * @param role - domain role assigned to the user
 * @returns the authenticated user with its embedded role and permissions
 */
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
