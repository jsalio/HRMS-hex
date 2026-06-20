import type { DeleteDepartmentRepository } from '../contracts/employees'
import { NotFoundError, DepartmentNotEmptyError } from '../domain/errors'

/**
 * Deletes a department, enforcing that no active employees remain assigned.
 */
export class DeleteDepartmentUseCase {
  /**
   * @param deptRepo - capabilities to read by id, count active employees, and delete
   */
  constructor(private readonly deptRepo: DeleteDepartmentRepository) {}

  /**
   * Deletes the department after verifying existence and that it has no active employees.
   *
   * Active employees are those with status ACTIVE, REMOTE, or ON_LEAVE.
   * Employees with status INACTIVE (terminated) do not block deletion at the
   * domain level, though the database FK may still reject the physical delete if
   * any row in the employees table references this department id — this is
   * documented as a known limitation (see hrms-departments.security.md SEC-2).
   *
   * @param id - identifier of the department to delete
   * @throws {NotFoundError} when no department with the given id exists
   * @throws {DepartmentNotEmptyError} when the department has active employees assigned
   */
  async execute(id: string): Promise<void> {
    const dept = await this.deptRepo.findById(id)
    if (!dept) throw new NotFoundError(`Department "${id}" not found`)

    const activeCount = await this.deptRepo.countActiveEmployees(id)
    if (activeCount > 0) throw new DepartmentNotEmptyError(dept.name)

    await this.deptRepo.delete(id)
  }
}
