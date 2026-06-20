import type { UpdateDepartmentRepository, Department } from '../contracts/employees'
import { NotFoundError, ConflictError, ValidationError } from '../domain/errors'

/**
 * Updates the name of an existing department, enforcing uniqueness.
 */
export class UpdateDepartmentUseCase {
  /**
   * @param deptRepo - capabilities to read by id, check name uniqueness, and persist changes
   */
  constructor(private readonly deptRepo: UpdateDepartmentRepository) {}

  /**
   * Updates the department name after verifying existence and uniqueness.
   *
   * - Trims the incoming name before any validation or persistence.
   * - Allows setting the same name the department already has (no false conflict).
   * - Raises ConflictError if a different department already uses the new name.
   *
   * @param id - identifier of the department to update
   * @param name - desired new name for the department
   * @returns the updated department
   * @throws {ValidationError} when the name is empty after trimming
   * @throws {NotFoundError} when no department with the given id exists
   * @throws {ConflictError} when a different department already has the new name
   */
  async execute(id: string, name: string): Promise<Department> {
    const trimmedName = name.trim()
    if (!trimmedName) throw new ValidationError('Department name cannot be empty')

    const current = await this.deptRepo.findById(id)
    if (!current) throw new NotFoundError(`Department "${id}" not found`)

    if (trimmedName !== current.name) {
      const taken = await this.deptRepo.findByName(trimmedName)
      if (taken) throw new ConflictError(`Department "${trimmedName}" already exists`)
    }

    return this.deptRepo.update(id, trimmedName)
  }
}
