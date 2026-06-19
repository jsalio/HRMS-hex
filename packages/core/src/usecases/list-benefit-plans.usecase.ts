import type { ListBenefitPlansRepository, BenefitPlanData } from '../contracts/benefits'

/**
 * Returns all benefit plans defined in the system.
 */
export class ListBenefitPlansUseCase {
  /**
   * @param repo - capability to read the full catalogue of benefit plans
   */
  constructor(private readonly repo: ListBenefitPlansRepository) {}

  /**
   * Fetches every benefit plan, including inactive ones.
   *
   * @returns the full list of benefit plans
   */
  async execute(): Promise<BenefitPlanData[]> {
    return this.repo.findAll()
  }
}
