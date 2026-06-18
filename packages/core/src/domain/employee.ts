import type { EmployeeStatus } from '../contracts/employees'
import { ValidationError } from './errors'

/**
 * Identity and lifecycle state required to construct an {@link Employee}.
 */
export interface EmployeeProps {
  id: string
  status: EmployeeStatus
}

/**
 * Domain entity representing an employee and its lifecycle status.
 * Enforces the invariants that protect operations against inactive employees.
 */
export class Employee {
  readonly id: string
  readonly status: EmployeeStatus

  /**
   * @param props - identity and lifecycle status of the employee
   */
  constructor(props: EmployeeProps) {
    this.id = props.id
    this.status = props.status
  }

  /**
   * Guards modification of the employee.
   *
   * @throws {ValidationError} when the employee is inactive and therefore cannot be modified
   */
  assertCanBeModified(): void {
    if (this.status === 'INACTIVE') {
      throw new ValidationError('Cannot modify an inactive employee')
    }
  }

  /**
   * Guards termination of the employee.
   *
   * @throws {ValidationError} when the employee is already inactive and therefore cannot be terminated
   */
  assertCanBeTerminated(): void {
    if (this.status === 'INACTIVE') {
      throw new ValidationError('Employee is already inactive')
    }
  }
}
