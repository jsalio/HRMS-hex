import type { GetEmployeeBenefitsRepository, EmployeeBenefitData } from '../contracts/benefits'
import { ForbiddenError } from '../domain/errors'

/** Roles that are permitted to view any employee's benefits. */
const MANAGER_ROLES = ['hr_manager', 'super_admin'] as const

/** Input required to fetch an employee's benefit enrollments. */
export interface GetEmployeeBenefitsInput {
  /** The employee whose benefits are being requested. */
  employeeId: string
  /** The authenticated user's own identifier, used to enforce ownership. */
  requestingUserId: string
  /** The authenticated user's role name, used to allow HR override. */
  requestingUserRole: string
}

/**
 * Returns the benefit enrollments of an employee, enforcing ownership access.
 */
export class GetEmployeeBenefitsUseCase {
  /**
   * @param repo - capability to read an employee's enrollments
   */
  constructor(private readonly repo: GetEmployeeBenefitsRepository) {}

  /**
   * Fetches enrollments for the target employee after verifying access rights.
   *
   * An employee may only view their own benefits. HR managers and super admins
   * may view any employee's benefits.
   *
   * @param input - target employeeId and the requesting user's identity
   * @returns the employee's benefit enrollment records, each including plan details
   * @throws {ForbiddenError} when the requester is not the target employee and lacks a manager role
   */
  async execute(input: GetEmployeeBenefitsInput): Promise<EmployeeBenefitData[]> {
    const isOwner   = input.requestingUserId === input.employeeId
    const isManager = (MANAGER_ROLES as readonly string[]).includes(input.requestingUserRole)
    if (!isOwner && !isManager) {
      throw new ForbiddenError('Access denied: you can only view your own benefits')
    }
    return this.repo.findByEmployee(input.employeeId)
  }
}
