import { AppModule, type RolePermission } from '../contracts/roles'
import { DomainError } from './errors'

export interface RoleProps {
  id: string
  name: string
  isSystem: boolean
  permissions: RolePermission[]
}

/**
 * Domain entity representing an authorization role and its permission set.
 * Enforces the invariants that protect system roles and the super_admin override.
 */
export class Role {
  readonly id: string
  private _name: string
  readonly isSystem: boolean
  private _permissions: RolePermission[]

  /**
   * @param props - identity, name, system flag and permission set of the role
   */
  constructor(props: RoleProps) {
    this.id = props.id
    this._name = props.name
    this.isSystem = props.isSystem
    this._permissions = props.permissions
  }

  /**
   * @returns the current role name
   */
  get name(): string {
    return this._name
  }

  /**
   * Renames the role.
   *
   * @param newName - the new role name
   * @throws {DomainError} when the role is a system role and cannot be renamed
   */
  rename(newName: string): void {
    if (this.isSystem) {
      throw new DomainError(`Cannot rename system role "${this._name}"`)
    }
    this._name = newName
  }

  /**
   * Guards deletion of the role.
   *
   * @throws {DomainError} when the role is a system role and cannot be deleted
   */
  assertCanDelete(): void {
    if (this.isSystem) {
      throw new DomainError(`Cannot delete system role "${this._name}"`)
    }
  }

  /**
   * Replaces the role's permission set.
   *
   * @param permissions - the new permission set to assign
   */
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
