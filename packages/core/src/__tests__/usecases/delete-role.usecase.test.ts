import { describe, it, expect, mock } from 'bun:test'
import { DeleteRoleUseCase } from '../../usecases/delete-role.usecase'
import { Role } from '../../domain/role'
import { DomainError } from '../../domain/errors'
import type { IRoleRepository } from '../../contracts/roles'

const systemRole = new Role({ id: 'r-sys', name: 'hr_manager', isSystem: true, permissions: [] })
const customRole = new Role({ id: 'r-cus', name: 'supervisor', isSystem: false, permissions: [] })

function makeRoleRepo(overrides: Partial<IRoleRepository> = {}): IRoleRepository {
  return {
    findAll: mock(() => Promise.resolve([customRole])),
    findById: mock(() => Promise.resolve(customRole)),
    findByName: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(customRole)),
    update: mock(() => Promise.resolve(customRole)),
    delete: mock(() => Promise.resolve()),
    ...overrides,
  }
}

describe('DeleteRoleUseCase', () => {
  // Test 2.13
  it('given_system_role_when_execute_then_throws_DomainError', async () => {
    const repo = makeRoleRepo({ findById: mock(() => Promise.resolve(systemRole)) })
    const useCase = new DeleteRoleUseCase(repo)
    await expect(useCase.execute('r-sys')).rejects.toThrow(DomainError)
  })

  it('given_custom_role_when_execute_then_deletes', async () => {
    const repo = makeRoleRepo()
    const useCase = new DeleteRoleUseCase(repo)
    await useCase.execute('r-cus')
    expect(repo.delete).toHaveBeenCalledWith('r-cus')
  })
})
