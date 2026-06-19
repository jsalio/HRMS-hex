import type { EnrollBenefitRepository, EmployeeBenefitData } from '../contracts/benefits'
import { BenefitPlan } from '../domain/benefit-plan'
import { ConflictError, NotFoundError } from '../domain/errors'

/** Input required to enroll an employee in a benefit plan. */
export interface EnrollBenefitInput {
  employeeId: string
  planId: string
  /** ISO date string (YYYY-MM-DD) representing the enrollment start date. */
  enrolledAt: string
}

/**
 * Enrolls an employee in a benefit plan, enforcing plan activity and uniqueness.
 */
export class EnrollBenefitUseCase {
  /**
   * @param repo - capabilities to verify the plan, check existing enrollment, and persist
   */
  constructor(private readonly repo: EnrollBenefitRepository) {}

  /**
   * Creates an enrollment after verifying the plan is active and the employee
   * is not already enrolled.
   *
   * @param input - target employee, plan, and enrollment start date
   * @returns the persisted enrollment record
   * @throws {NotFoundError} when no plan exists with the given planId
   * @throws {ValidationError} when the plan is inactive
   * @throws {ConflictError} when an active enrollment for the same employee–plan pair already exists
   */
  async execute(input: EnrollBenefitInput): Promise<EmployeeBenefitData> {
    const planData = await this.repo.findById(input.planId)
    if (!planData) throw new NotFoundError(`Benefit plan "${input.planId}" not found`)

    const plan = new BenefitPlan(planData)
    plan.assertIsActive()

    const existing = await this.repo.findEnrollment(input.employeeId, input.planId)
    if (existing && existing.unenrolledAt === null) {
      throw new ConflictError(
        `Employee "${input.employeeId}" is already enrolled in plan "${input.planId}"`
      )
    }

    return this.repo.enroll(input.employeeId, input.planId, input.enrolledAt)
  }
}
