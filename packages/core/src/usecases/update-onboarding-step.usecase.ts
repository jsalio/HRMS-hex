import type { UpdateOnboardingStepRepository, EmployeeOnboarding, OnboardingStepName } from '../contracts/employees'
import { NotFoundError } from '../domain/errors'

/**
 * Updates a single onboarding step of an employee.
 */
export class UpdateOnboardingStepUseCase {
  /**
   * @param employeeRepo - capabilities to verify the employee exists and update one step
   */
  constructor(private readonly employeeRepo: UpdateOnboardingStepRepository) {}

  /**
   * Updates one onboarding step after confirming the employee exists.
   *
   * @param employeeId - identifier of the employee
   * @param step - the onboarding step to update
   * @param completed - whether the step is now completed
   * @param notes - optional notes attached to the step
   * @returns the updated onboarding step
   * @throws {NotFoundError} when no employee exists with the given id
   */
  async execute(
    employeeId: string,
    step: OnboardingStepName,
    completed: boolean,
    notes?: string,
  ): Promise<EmployeeOnboarding> {
    const existing = await this.employeeRepo.findById(employeeId)
    if (!existing) throw new NotFoundError(`Employee ${employeeId} not found`)
    return this.employeeRepo.updateOnboardingStep(employeeId, step, completed, notes)
  }
}
