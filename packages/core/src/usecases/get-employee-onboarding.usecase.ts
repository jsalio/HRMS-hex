import type { GetEmployeeOnboardingRepository, EmployeeOnboarding } from '../contracts/employees'
import { NotFoundError } from '../domain/errors'

/**
 * Retrieves the onboarding steps of an employee.
 */
export class GetEmployeeOnboardingUseCase {
  /**
   * @param employeeRepo - capabilities to verify the employee exists and read its onboarding
   */
  constructor(private readonly employeeRepo: GetEmployeeOnboardingRepository) {}

  /**
   * Loads the onboarding steps for an employee after confirming it exists.
   *
   * @param employeeId - identifier of the employee
   * @returns the employee's onboarding steps
   * @throws {NotFoundError} when no employee exists with the given id
   */
  async execute(employeeId: string): Promise<EmployeeOnboarding[]> {
    const existing = await this.employeeRepo.findById(employeeId)
    if (!existing) throw new NotFoundError(`Employee ${employeeId} not found`)
    return this.employeeRepo.findOnboarding(employeeId)
  }
}
