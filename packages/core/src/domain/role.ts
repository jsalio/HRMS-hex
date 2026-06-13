import { AppModule, type RolePermission } from '../contracts/roles'
import { DomainError } from './errors'

export interface RoleProps {
  id: string
  name: string
  isSystem: boolean
  permissions: RolePermission[]
}

export class Role {
  readonly id: string
  private _name: string
  readonly isSystem: boolean
  private _permissions: RolePermission[]

  constructor(props: RoleProps) {
    this.id = props.id
    this._name = props.name
    this.isSystem = props.isSystem
    this._permissions = props.permissions
  }

  get name(): string {
    return this._name
  }

  rename(newName: string): void {
    if (this.isSystem) {
      throw new DomainError(`Cannot rename system role "${this._name}"`)
    }
    this._name = newName
  }

  assertCanDelete(): void {
    if (this.isSystem) {
      throw new DomainError(`Cannot delete system role "${this._name}"`)
    }
  }

  updatePermissions(permissions: RolePermission[]): void {
    this._permissions = permissions
  }

  /**
   * Returns the effective permission set for this role.
   * super_admin invariant: always returns all permissions as true regardless of stored values.
   */
  toAuthPermissions(): RolePermission[] {
    if (this._name === 'super_admin') {
      return Object.values(AppModule).map(module => ({
        module,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      }))
    }
    return this._permissions
  }
}
