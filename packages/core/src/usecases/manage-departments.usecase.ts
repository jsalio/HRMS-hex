import type { IDepartmentRepository, Department } from '../contracts/employees'
import { ConflictError } from '../domain/errors'

export class ManageDepartmentsUseCase {
  constructor(private readonly deptRepo: IDepartmentRepository) {}

  async listDepartments(): Promise<Department[]> {
    return this.deptRepo.findAll()
  }

  async createDepartment(name: string): Promise<Department> {
    const existing = await this.deptRepo.findByName(name)
    if (existing) throw new ConflictError(`Department "${name}" already exists`)
    return this.deptRepo.create(name)
  }
}
