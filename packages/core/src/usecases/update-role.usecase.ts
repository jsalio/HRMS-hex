import type { UpdateRoleRepository, UpdateRoleData } from '../contracts/roles'
import { Role } from '../domain/role'
import { NotFoundError } from '../domain/errors'

/**
 * Updates an existing role's name and/or permission set.
 */
export class UpdateRoleUseCase {
  /**
   * @param roleRepo - capabilities to load and persist the role
   */
  constructor(private readonly roleRepo: UpdateRoleRepository) {}

  /**
   * Updates a role, validating domain rules before persisting.
   *
   * @param id - identifier of the role to update
   * @param data - optional new name and/or permission set
   * @returns the updated role
   * @throws {NotFoundError} when no role exists with the given id
   * @throws {DomainError} when attempting to rename a system role
   */
  async execute(id: string, data: UpdateRoleData): Promise<Role> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw new NotFoundError(`Role ${id} not found`)

    if (data.name && data.name !== role.name) {
      role.rename(data.name)
    }

    return this.roleRepo.update(id, data)
  }
}
