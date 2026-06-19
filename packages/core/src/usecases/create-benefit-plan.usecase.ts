import type { CreateBenefitPlanRepository, CreateBenefitPlanInput, BenefitPlanData } from '../contracts/benefits'
import { assertValidPlanType } from '../domain/benefit-plan'
import { ConflictError } from '../domain/errors'

/**
 * Creates a new benefit plan, enforcing name uniqueness and type validity.
 */
export class CreateBenefitPlanUseCase {
  /**
   * @param repo - capabilities to check name uniqueness and persist the plan
   */
  constructor(private readonly repo: CreateBenefitPlanRepository) {}

  /**
   * Validates and persists a new benefit plan.
   *
   * @param input - name, type, and optional metadata for the plan
   * @returns the persisted benefit plan with its generated id
   * @throws {ValidationError} when the plan type is not a valid BenefitPlanType
   * @throws {ConflictError} when a plan with the same name already exists
   */
  async execute(input: CreateBenefitPlanInput): Promise<BenefitPlanData> {
    assertValidPlanType(input.type)
    const existing = await this.repo.findByName(input.name)
    if (existing) throw new ConflictError(`Benefit plan "${input.name}" already exists`)
    return this.repo.create(input)
  }
}
