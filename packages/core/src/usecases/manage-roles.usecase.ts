import type { IRoleRepository, CreateRoleData, UpdateRoleData } from '../contracts/roles'
import { Role } from '../domain/role'
import { ConflictError, NotFoundError } from '../domain/errors'

export class ManageRolesUseCase {
  constructor(private readonly roleRepo: IRoleRepository) {}

  async listRoles(): Promise<Role[]> {
    return this.roleRepo.findAll()
  }

  async createRole(data: CreateRoleData): Promise<Role> {
    const existing = await this.roleRepo.findByName(data.name)
    if (existing) throw new ConflictError(`Role "${data.name}" already exists`)
    return this.roleRepo.create(data)
  }

  async updateRole(id: string, data: UpdateRoleData): Promise<Role> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw new NotFoundError(`Role ${id} not found`)

    if (data.name && data.name !== role.name) {
      role.rename(data.name)
    }

    return this.roleRepo.update(id, data)
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw new NotFoundError(`Role ${id} not found`)
    role.assertCanDelete()
    return this.roleRepo.delete(id)
  }
}
