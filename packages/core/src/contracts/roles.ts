// FROZEN CONTRACT — changes here break sub-specs 2-10
export enum AppModule {
  DASHBOARD     = 'dashboard',
  EMPLOYEES     = 'employees',
  ATTENDANCE    = 'attendance',
  PAYROLL       = 'payroll',
  REPORTS       = 'reports',
  SETTINGS      = 'settings',
  DOCUMENTS     = 'documents',
  ABSENCES      = 'absences',
  BENEFITS      = 'benefits',
  RECRUITMENT   = 'recruitment',
  NOTIFICATIONS = 'notifications',
}

/**
 * Per-module CRUD permission flags granted to a role.
 */
export interface RolePermission {
  /** Module the flags apply to */
  module: AppModule
  /** Whether the role can read the module's resources */
  canView: boolean
  /** Whether the role can create resources in the module */
  canCreate: boolean
  /** Whether the role can modify resources in the module */
  canEdit: boolean
  /** Whether the role can delete resources in the module */
  canDelete: boolean
  /** Whether the role can export the module's data */
  canExport: boolean
}

/**
 * Input required to create a role.
 */
export interface CreateRoleData {
  name: string
  permissions: RolePermission[]
}

/**
 * Input to update a role. Fields are optional; only provided fields change.
 */
export interface UpdateRoleData {
  name?: string
  permissions?: RolePermission[]
}

type Role = import('../domain/role').Role

// ── Atomic capabilities — each defined once, one responsibility ──────────────

/** Capability: read the full role catalogue. */
export interface IFindAllRoles {
  /** @returns every role stored */
  findAll(): Promise<Role[]>
}

/** Capability: read a single role by identifier. */
export interface IFindRoleById {
  /** @returns the role with the given id, or null if none exists */
  findById(id: string): Promise<Role | null>
}

/** Capability: read a single role by name (used for uniqueness checks). */
export interface IFindRoleByName {
  /** @returns the role with the given name, or null if none exists */
  findByName(name: string): Promise<Role | null>
}

/** Capability: persist a new role. */
export interface ICreateRole {
  /** Persists a new role and returns it. */
  create(data: CreateRoleData): Promise<Role>
}

/** Capability: persist changes to an existing role. */
export interface IUpdateRole {
  /** Persists changes to an existing role and returns the updated entity. */
  update(id: string, data: UpdateRoleData): Promise<Role>
}

/** Capability: remove a role. */
export interface IDeleteRole {
  /** Removes the role with the given id. */
  delete(id: string): Promise<void>
}

// ── Use-case contracts — composed from exactly the needed capabilities ───────

/** Dependencies of the list-roles use case. */
export type ListRolesRepository = IFindAllRoles

/** Dependencies of the create-role use case. */
export type CreateRoleRepository = IFindRoleByName & ICreateRole

/** Dependencies of the update-role use case. */
export type UpdateRoleRepository = IFindRoleById & IUpdateRole

/** Dependencies of the delete-role use case. */
export type DeleteRoleRepository = IFindRoleById & IDeleteRole

// ── Full persistence port — the single adapter implements every capability ───

/**
 * Persistence port for roles. Implemented by one adapter in the boundary layer,
 * which therefore satisfies every composed use-case contract above.
 */
export interface IRoleRepository
  extends IFindAllRoles, IFindRoleById, IFindRoleByName,
          ICreateRole, IUpdateRole, IDeleteRole {}
