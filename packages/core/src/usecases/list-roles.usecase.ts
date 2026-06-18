import type { ListRolesRepository } from '../contracts/roles'
import { Role } from '../domain/role'

/**
 * Retrieves the complete catalogue of roles defined in the system.
 */
export class ListRolesUseCase {
  /**
   * @param roleRepo - capability to read all roles
   */
  constructor(private readonly roleRepo: ListRolesRepository) {}

  /**
   * Lists every role, including system and custom roles.
   *
   * @returns all roles currently stored, in repository order
   */
  async execute(): Promise<Role[]> {
    return this.roleRepo.findAll()
  }
}
