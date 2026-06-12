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

export interface RolePermission {
  module: AppModule
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
}

export interface CreateRoleData {
  name: string
  permissions: RolePermission[]
}

export interface UpdateRoleData {
  name?: string
  permissions?: RolePermission[]
}

export interface IRoleRepository {
  findAll(): Promise<import('../domain/role').Role[]>
  findById(id: string): Promise<import('../domain/role').Role | null>
  findByName(name: string): Promise<import('../domain/role').Role | null>
  create(data: CreateRoleData): Promise<import('../domain/role').Role>
  update(id: string, data: UpdateRoleData): Promise<import('../domain/role').Role>
  delete(id: string): Promise<void>
}
