import type { UpdateEmployeeRepository, UpdateEmployeeInput, EmployeeSummary } from '../contracts/employees'
import type { IFindDepartmentById } from '../contracts/employees'
import { Employee } from '../domain/employee'
import { NotFoundError } from '../domain/errors'

/**
 * Updates an existing employee's mutable attributes.
 */
export class UpdateEmployeeUseCase {
  /**
   * @param employeeRepo - capabilities to load and persist the employee
   * @param deptRepo - capability to verify a reassigned department exists
   */
  constructor(
    private readonly employeeRepo: UpdateEmployeeRepository,
    private readonly deptRepo: IFindDepartmentById,
  ) {}

  /**
   * Updates an employee after verifying it can be modified and, when a new
   * department is provided, that the department exists.
   *
   * @param id - identifier of the employee to update
   * @param input - the attributes to change
   * @returns the updated employee summary
   * @throws {NotFoundError} when the employee or a reassigned department is missing
   * @throws {ValidationError} when the employee's status forbids modification
   */
  async execute(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary> {
    const existing = await this.employeeRepo.findById(id)
    if (!existing) throw new NotFoundError(`Employee ${id} not found`)

    new Employee({ id: existing.id, status: existing.status }).assertCanBeModified()

    if (input.departmentId) {
      const dept = await this.deptRepo.findById(input.departmentId)
      if (!dept) throw new NotFoundError(`Department ${input.departmentId} not found`)
    }

    return this.employeeRepo.update(id, input)
  }
}
