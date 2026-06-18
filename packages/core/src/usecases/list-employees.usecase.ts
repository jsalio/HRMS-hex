import type { ListEmployeesRepository, EmployeeListQuery, EmployeeListResult } from '../contracts/employees'

/**
 * Retrieves a paginated, filtered page of employees.
 */
export class ListEmployeesUseCase {
  /**
   * @param employeeRepo - capability to read pages of employees
   */
  constructor(private readonly employeeRepo: ListEmployeesRepository) {}

  /**
   * Lists employees matching the given filters and pagination.
   *
   * @param query - department, status, search and pagination filters
   * @returns the matching page of employee summaries
   */
  async execute(query: EmployeeListQuery): Promise<EmployeeListResult> {
    return this.employeeRepo.findAll(query)
  }
}
