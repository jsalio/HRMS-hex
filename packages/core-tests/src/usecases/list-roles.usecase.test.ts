import { describe, it, expect, mock } from 'bun:test'
import { ListRolesUseCase } from '@hrms/core/usecases/list-roles.usecase'
import { Role } from '@hrms/core/domain/role'
import type { IRoleRepository } from '@hrms/core/contracts/roles'

const systemRole = new Role({ id: 'r-sys', name: 'hr_manager', isSystem: true, permissions: [] })
const customRole = new Role({ id: 'r-cus', name: 'supervisor', isSystem: false, permissions: [] })

function makeRoleRepo(overrides: Partial<IRoleRepository> = {}): IRoleRepository {
  return {
    findAll: mock(() => Promise.resolve([systemRole, customRole])),
    findById: mock(() => Promise.resolve(customRole)),
    findByName: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(customRole)),
    update: mock(() => Promise.resolve(customRole)),
    delete: mock(() => Promise.resolve()),
    ...overrides,
  }
}

describe('ListRolesUseCase', () => {
  it('given_roles_exist_when_execute_then_returns_all_roles', async () => {
    const useCase = new ListRolesUseCase(makeRoleRepo())
    const result = await useCase.execute()
    expect(result).toHaveLength(2)
  })
})
