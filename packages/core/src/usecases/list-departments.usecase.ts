import type { ListDepartmentsRepository, Department } from '../contracts/employees'

/**
 * Retrieves the complete catalogue of departments.
 */
export class ListDepartmentsUseCase {
  /**
   * @param deptRepo - capability to read all departments
   */
  constructor(private readonly deptRepo: ListDepartmentsRepository) {}

  /**
   * Lists every department.
   *
   * @returns all departments currently stored
   */
  async execute(): Promise<Department[]> {
    return this.deptRepo.findAll()
  }
}
