import type { Role } from '@hrms/core/domain/role'
import { AppModule } from '@hrms/core/contracts/roles'

/**
 * API representation of a role, exposing its identity, system flag and the
 * flattened per-module permission matrix.
 */
export interface RoleDTO {
  id: string
  name: string
  isSystem: boolean
  permissions: Array<{
    module: AppModule
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  }>
}

/**
 * Converts a domain role into its API DTO, flattening its permissions into
 * the auth permission matrix.
 *
 * @param role - domain role to convert
 * @returns the role DTO exposed by the HTTP layer
 */
export function toRoleDTO(role: Role): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: role.toAuthPermissions(),
  }
}
