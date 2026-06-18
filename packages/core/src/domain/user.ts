import { UnauthorizedError } from './errors'

/**
 * Identity, credentials and account state required to construct a {@link User}.
 */
export interface UserProps {
  id: string
  email: string
  passwordHash: string
  isActive: boolean
  roleId: string
  /** Identifier of the linked employee, or null when the user is not tied to an employee record. */
  employeeId?: string | null
  /** Timestamp of the last successful login, or null when the user has never logged in. */
  lastLoginAt?: Date | null
}

/**
 * Domain entity representing an application user account and its credentials.
 * Enforces the invariants that govern whether the account may authenticate.
 */
export class User {
  readonly id: string
  readonly email: string
  readonly passwordHash: string
  readonly isActive: boolean
  readonly roleId: string
  readonly employeeId: string | null
  readonly lastLoginAt: Date | null

  /**
   * @param props - identity, credentials, role and account state of the user
   */
  constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.passwordHash = props.passwordHash
    this.isActive = props.isActive
    this.roleId = props.roleId
    this.employeeId = props.employeeId ?? null
    this.lastLoginAt = props.lastLoginAt ?? null
  }

  /**
   * Guards authentication of the user.
   *
   * @throws {UnauthorizedError} when the account is inactive and therefore cannot authenticate
   */
  assertCanAuthenticate(): void {
    if (!this.isActive) {
      throw new UnauthorizedError('User account is inactive')
    }
  }
}
