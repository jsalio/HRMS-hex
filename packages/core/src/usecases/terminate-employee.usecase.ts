import type { TerminateEmployeeRepository, EmployeeSummary } from '../contracts/employees'
import type { IUserRepository, IRefreshTokenRepository } from '../contracts/auth'
import { Employee } from '../domain/employee'
import { NotFoundError } from '../domain/errors'

/**
 * Terminates an employee and deactivates its associated user account.
 */
export class TerminateEmployeeUseCase {
  /**
   * @param employeeRepo - capabilities to load and terminate the employee
   * @param userRepo - capability to locate and deactivate the associated account
   * @param refreshTokenRepo - capability to revoke the account's refresh tokens
   */
  constructor(
    private readonly employeeRepo: TerminateEmployeeRepository,
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  /**
   * Terminates an employee after verifying it can be terminated, then
   * deactivates its user account and revokes its refresh tokens.
   *
   * @param id - identifier of the employee to terminate
   * @param terminationDate - effective termination date
   * @returns the terminated employee summary
   * @throws {NotFoundError} when no employee exists with the given id
   * @throws {ValidationError} when the employee's status forbids termination
   */
  async execute(id: string, terminationDate: Date): Promise<EmployeeSummary> {
    const existing = await this.employeeRepo.findById(id)
    if (!existing) throw new NotFoundError(`Employee ${id} not found`)

    new Employee({ id: existing.id, status: existing.status }).assertCanBeTerminated()

    const terminated = await this.employeeRepo.terminate(id, terminationDate)

    // Deactivate associated user account and revoke tokens
    const user = await this.userRepo.findByEmail(existing.corporateEmail)
    if (user) {
      await this.userRepo.deactivate(user.id)
      await this.refreshTokenRepo.revokeAllForUser(user.id)
    }

    return terminated
  }
}
