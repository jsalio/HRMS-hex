import type { CreateDepartmentRepository, Department } from '../contracts/employees'
import { ConflictError } from '../domain/errors'

/**
 * Creates a new department, enforcing name uniqueness.
 */
export class CreateDepartmentUseCase {
  /**
   * @param deptRepo - capabilities to check name uniqueness and persist the department
   */
  constructor(private readonly deptRepo: CreateDepartmentRepository) {}

  /**
   * Creates a department after verifying that its name is not already taken.
   *
   * @param name - the name of the new department
   * @returns the persisted department
   * @throws {ConflictError} when a department with the same name already exists
   */
  async execute(name: string): Promise<Department> {
    const existing = await this.deptRepo.findByName(name)
    if (existing) throw new ConflictError(`Department "${name}" already exists`)
    return this.deptRepo.create(name)
  }
}
