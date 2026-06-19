import type { UnenrollBenefitRepository, EmployeeBenefitData } from '../contracts/benefits'
import { NotFoundError } from '../domain/errors'

/** Input required to unenroll an employee from a benefit plan. */
export interface UnenrollBenefitInput {
  employeeId: string
  planId: string
  /** ISO date string (YYYY-MM-DD) representing the effective unenrollment date. */
  unenrolledAt: string
}

/**
 * Unenrolls an employee from a benefit plan by recording an unenrollment date.
 */
export class UnenrollBenefitUseCase {
  /**
   * @param repo - capabilities to verify the enrollment and persist the unenrollment date
   */
  constructor(private readonly repo: UnenrollBenefitRepository) {}

  /**
   * Sets the unenrolled_at date on an existing enrollment.
   *
   * @param input - employee, plan, and effective unenrollment date
   * @returns the updated enrollment record with unenrolledAt set
   * @throws {NotFoundError} when no active enrollment exists for the employee–plan pair
   */
  async execute(input: UnenrollBenefitInput): Promise<EmployeeBenefitData> {
    const enrollment = await this.repo.findEnrollment(input.employeeId, input.planId)
    if (!enrollment) {
      throw new NotFoundError(
        `No enrollment found for employee "${input.employeeId}" in plan "${input.planId}"`
      )
    }
    return this.repo.unenroll(input.employeeId, input.planId, input.unenrolledAt)
  }
}
