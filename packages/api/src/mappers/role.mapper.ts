import type { Role } from '@hrms/core/domain/role'
import { AppModule } from '@hrms/core/contracts/roles'

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

export function toRoleDTO(role: Role): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissions: role.toAuthPermissions(),
  }
}
