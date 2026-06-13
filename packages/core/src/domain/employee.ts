import type { EmployeeStatus } from '../contracts/employees'
import { ValidationError } from './errors'

export interface EmployeeProps {
  id: string
  status: EmployeeStatus
}

export class Employee {
  readonly id: string
  readonly status: EmployeeStatus

  constructor(props: EmployeeProps) {
    this.id = props.id
    this.status = props.status
  }

  assertCanBeModified(): void {
    if (this.status === 'INACTIVE') {
      throw new ValidationError('Cannot modify an inactive employee')
    }
  }

  assertCanBeTerminated(): void {
    if (this.status === 'INACTIVE') {
      throw new ValidationError('Employee is already inactive')
    }
  }
}
