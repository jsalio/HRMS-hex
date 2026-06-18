import type { DeleteRoleRepository } from '../contracts/roles'
import { NotFoundError } from '../domain/errors'

/**
 * Deletes a custom role, preventing removal of system roles.
 */
export class DeleteRoleUseCase {
  /**
   * @param roleRepo - capabilities to load and delete the role
   */
  constructor(private readonly roleRepo: DeleteRoleRepository) {}

  /**
   * Deletes a role after confirming it exists and is not a system role.
   *
   * @param id - identifier of the role to delete
   * @throws {NotFoundError} when no role exists with the given id
   * @throws {DomainError} when the role is a system role and cannot be deleted
   */
  async execute(id: string): Promise<void> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw new NotFoundError(`Role ${id} not found`)
    role.assertCanDelete()
    return this.roleRepo.delete(id)
  }
}
