import type { Sql } from 'postgres'
import { Role } from '@hrms/core/domain/role'
import type { IRoleRepository, CreateRoleData, UpdateRoleData, RolePermission } from '@hrms/core/contracts/roles'
import { AppModule } from '@hrms/core/contracts/roles'

interface RoleRow {
  id: string
  name: string
  is_system: boolean
}

interface PermissionRow {
  role_id: string
  module: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
}

function toRolePermission(row: PermissionRow): RolePermission {
  return {
    module: row.module as AppModule,
    canView: row.can_view,
    canCreate: row.can_create,
    canEdit: row.can_edit,
    canDelete: row.can_delete,
    canExport: row.can_export,
  }
}

function toRole(row: RoleRow, permissions: PermissionRow[]): Role {
  return new Role({
    id: row.id,
    name: row.name,
    isSystem: row.is_system,
    permissions: permissions.filter(p => p.role_id === row.id).map(toRolePermission),
  })
}

export class RoleRepository implements IRoleRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(): Promise<Role[]> {
    const [roles, permissions] = await Promise.all([
      this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles ORDER BY name`,
      this.sql<PermissionRow[]>`SELECT * FROM role_permissions`,
    ])
    return roles.map(r => toRole(r, permissions))
  }

  async findById(id: string): Promise<Role | null> {
    const [roles, permissions] = await Promise.all([
      this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles WHERE id = ${id}`,
      this.sql<PermissionRow[]>`SELECT * FROM role_permissions WHERE role_id = ${id}`,
    ])
    if (!roles[0]) return null
    return toRole(roles[0], permissions)
  }

  async findByName(name: string): Promise<Role | null> {
    const rows = await this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles WHERE name = ${name}`
    if (!rows[0]) return null
    const perms = await this.sql<PermissionRow[]>`SELECT * FROM role_permissions WHERE role_id = ${rows[0].id}`
    return toRole(rows[0], perms)
  }

  async create(data: CreateRoleData): Promise<Role> {
    const [role] = await this.sql<RoleRow[]>`
      INSERT INTO roles (name, is_system) VALUES (${data.name}, false) RETURNING id, name, is_system
    `
    if (!role) throw new Error('Role creation failed')

    if (data.permissions.length > 0) {
      await this.sql`
        INSERT INTO role_permissions ${this.sql(
          data.permissions.map(p => ({
            role_id: role.id,
            module: p.module,
            can_view: p.canView,
            can_create: p.canCreate,
            can_edit: p.canEdit,
            can_delete: p.canDelete,
            can_export: p.canExport,
          }))
        )}
      `
    }

    return this.findById(role.id).then(r => r!)
  }

  async update(id: string, data: UpdateRoleData): Promise<Role> {
    if (data.name) {
      await this.sql`UPDATE roles SET name = ${data.name}, updated_at = now() WHERE id = ${id}`
    }

    if (data.permissions) {
      await this.sql`DELETE FROM role_permissions WHERE role_id = ${id}`
      if (data.permissions.length > 0) {
        await this.sql`
          INSERT INTO role_permissions ${this.sql(
            data.permissions.map(p => ({
              role_id: id,
              module: p.module,
              can_view: p.canView,
              can_create: p.canCreate,
              can_edit: p.canEdit,
              can_delete: p.canDelete,
              can_export: p.canExport,
            }))
          )}
        `
      }
    }

    return this.findById(id).then(r => r!)
  }

  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM roles WHERE id = ${id}`
  }
}
