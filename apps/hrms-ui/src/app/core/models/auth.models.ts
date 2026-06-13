// Mirror of @hrms/core AuthenticatedUser — UI never imports backend packages
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

// FROZEN CONTRACT — shape must match API response exactly
export interface AuthenticatedUser {
  id: string
  email: string
  role: {
    id: string
    name: string
    permissions: RolePermission[]
  }
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: AuthenticatedUser
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
}
