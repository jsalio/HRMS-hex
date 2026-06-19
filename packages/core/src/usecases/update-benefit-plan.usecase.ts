import type { UpdateBenefitPlanRepository, BenefitPlanData, BenefitPlanType } from '../contracts/benefits'
import { assertValidPlanType } from '../domain/benefit-plan'
import { NotFoundError } from '../domain/errors'

/** Fields that may be updated on an existing benefit plan. */
export interface UpdateBenefitPlanInput {
  name?: string
  type?: BenefitPlanType
  description?: string
  provider?: string
  cost?: number
  isActive?: boolean
}

/**
 * Updates the mutable fields of an existing benefit plan.
 */
export class UpdateBenefitPlanUseCase {
  /**
   * @param repo - capabilities to locate the plan and persist changes
   */
  constructor(private readonly repo: UpdateBenefitPlanRepository) {}

  /**
   * Validates and applies updates to an existing plan.
   *
   * @param id - identifier of the plan to update
   * @param input - fields to update; only supplied fields are changed
   * @returns the updated benefit plan record
   * @throws {NotFoundError} when no plan exists with the given id
   * @throws {ValidationError} when a supplied type value is not a valid BenefitPlanType
   */
  async execute(id: string, input: UpdateBenefitPlanInput): Promise<BenefitPlanData> {
    if (input.type !== undefined) assertValidPlanType(input.type)
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError(`Benefit plan "${id}" not found`)
    return this.repo.update(id, input)
  }
}
