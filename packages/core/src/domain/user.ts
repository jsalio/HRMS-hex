import { UnauthorizedError } from './errors'

export interface UserProps {
  id: string
  email: string
  passwordHash: string
  isActive: boolean
  roleId: string
  employeeId?: string | null
  lastLoginAt?: Date | null
}

export class User {
  readonly id: string
  readonly email: string
  readonly passwordHash: string
  readonly isActive: boolean
  readonly roleId: string
  readonly employeeId: string | null
  readonly lastLoginAt: Date | null

  constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.passwordHash = props.passwordHash
    this.isActive = props.isActive
    this.roleId = props.roleId
    this.employeeId = props.employeeId ?? null
    this.lastLoginAt = props.lastLoginAt ?? null
  }

  assertCanAuthenticate(): void {
    if (!this.isActive) {
      throw new UnauthorizedError('User account is inactive')
    }
  }
}
