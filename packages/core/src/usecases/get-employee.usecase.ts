import type { GetEmployeeRepository, EmployeeDetail } from '../contracts/employees'
import { NotFoundError } from '../domain/errors'

/**
 * Retrieves a single employee's full detail.
 */
export class GetEmployeeUseCase {
  /**
   * @param employeeRepo - capability to load an employee by id
   */
  constructor(private readonly employeeRepo: GetEmployeeRepository) {}

  /**
   * Loads an employee by identifier.
   *
   * @param id - identifier of the employee to load
   * @returns the employee's full detail
   * @throws {NotFoundError} when no employee exists with the given id
   */
  async execute(id: string): Promise<EmployeeDetail> {
    const employee = await this.employeeRepo.findById(id)
    if (!employee) throw new NotFoundError(`Employee ${id} not found`)
    return employee
  }
}
