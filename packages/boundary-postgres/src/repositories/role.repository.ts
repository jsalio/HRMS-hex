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

/** Maps a raw role_permissions table row to a RolePermission. */
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

/** Builds a Role domain entity from its row and the permission rows belonging to it. */
function toRole(row: RoleRow, permissions: PermissionRow[]): Role {
  return new Role({
    id: row.id,
    name: row.name,
    isSystem: row.is_system,
    permissions: permissions.filter(p => p.role_id === row.id).map(toRolePermission),
  })
}

/**
 * Postgres adapter implementing IRoleRepository over the `roles` and `role_permissions` tables.
 */
export class RoleRepository implements IRoleRepository {
  /**
   * @param sql - Postgres client used to execute role queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads every role together with its permissions, ordered by name.
   *
   * @returns all roles stored in the system
   */
  async findAll(): Promise<Role[]> {
    const [roles, permissions] = await Promise.all([
      this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles ORDER BY name`,
      this.sql<PermissionRow[]>`SELECT * FROM role_permissions`,
    ])
    return roles.map(r => toRole(r, permissions))
  }

  /**
   * Reads a single role with its permissions by identifier.
   *
   * @param id - identifier of the role to read
   * @returns the matching role, or null when none exists
   */
  async findById(id: string): Promise<Role | null> {
    const [roles, permissions] = await Promise.all([
      this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles WHERE id = ${id}`,
      this.sql<PermissionRow[]>`SELECT * FROM role_permissions WHERE role_id = ${id}`,
    ])
    if (!roles[0]) return null
    return toRole(roles[0], permissions)
  }

  /**
   * Reads a single role with its permissions by unique name.
   *
   * @param name - name of the role to read
   * @returns the matching role, or null when none exists
   */
  async findByName(name: string): Promise<Role | null> {
    const rows = await this.sql<RoleRow[]>`SELECT id, name, is_system FROM roles WHERE name = ${name}`
    if (!rows[0]) return null
    const perms = await this.sql<PermissionRow[]>`SELECT * FROM role_permissions WHERE role_id = ${rows[0].id}`
    return toRole(rows[0], perms)
  }

  /**
   * Persists a new non-system role together with its permission set.
   *
   * @param data - name and permissions for the new role
   * @returns the created role with its persisted permissions
   * @throws {Error} when the role insert returns no row
   */
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

  /**
   * Updates a role's name and/or replaces its full permission set.
   *
   * @param id - identifier of the role to update
   * @param data - optional new name and/or replacement permissions
   * @returns the updated role with its current permissions
   */
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

  /**
   * Deletes a role by its identifier.
   *
   * @param id - identifier of the role to delete
   */
  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM roles WHERE id = ${id}`
  }
}
