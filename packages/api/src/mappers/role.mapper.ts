import type { Role } from '@hrms/core/domain/role'

export interface RoleDTO {
  id: string
  name: string
  isSystem: boolean
  permissions: Array<{
    module: string
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  }>
}

export function toRoleDTO(role: Role): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: role.toAuthPermissions(),
  }
}
