import type { CreateRoleRepository, CreateRoleData } from '../contracts/roles'
import { Role } from '../domain/role'
import { ConflictError } from '../domain/errors'

/**
 * Creates a new custom role, enforcing name uniqueness.
 */
export class CreateRoleUseCase {
  /**
   * @param roleRepo - capabilities to check name uniqueness and persist the role
   */
  constructor(private readonly roleRepo: CreateRoleRepository) {}

  /**
   * Creates a role after verifying that its name is not already taken.
   *
   * @param data - name and permission set for the new role
   * @returns the persisted role
   * @throws {ConflictError} when a role with the same name already exists
   */
  async execute(data: CreateRoleData): Promise<Role> {
    const existing = await this.roleRepo.findByName(data.name)
    if (existing) throw new ConflictError(`Role "${data.name}" already exists`)
    return this.roleRepo.create(data)
  }
}
