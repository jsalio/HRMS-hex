import { describe, it, expect, mock } from 'bun:test'
import { CreateRoleUseCase } from '../../usecases/create-role.usecase'
import { Role } from '../../domain/role'
import { ConflictError } from '../../domain/errors'
import type { IRoleRepository } from '../../contracts/roles'

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

describe('CreateRoleUseCase', () => {
  // Test 2.11
  it('given_valid_role_data_when_execute_then_returns_role', async () => {
    const useCase = new CreateRoleUseCase(makeRoleRepo())
    const result = await useCase.execute({ name: 'supervisor', permissions: [] })
    expect(result.id).toBe('r-cus')
  })

  // Test 2.12
  it('given_duplicate_name_when_execute_then_throws_ConflictError', async () => {
    const repo = makeRoleRepo({ findByName: mock(() => Promise.resolve(customRole)) })
    const useCase = new CreateRoleUseCase(repo)
    await expect(useCase.execute({ name: 'supervisor', permissions: [] })).rejects.toThrow(ConflictError)
  })
})
