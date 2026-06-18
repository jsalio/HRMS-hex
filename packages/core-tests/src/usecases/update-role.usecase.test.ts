import { describe, it, expect, mock } from 'bun:test'
import { UpdateRoleUseCase } from '@hrms/core/usecases/update-role.usecase'
import { Role } from '@hrms/core/domain/role'
import { AppModule } from '@hrms/core/contracts/roles'
import type { IRoleRepository } from '@hrms/core/contracts/roles'

const customRole = new Role({ id: 'r-cus', name: 'supervisor', isSystem: false, permissions: [] })
const superAdminRole = new Role({ id: 'r-sa', name: 'super_admin', isSystem: true, permissions: [] })

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

describe('UpdateRoleUseCase', () => {
  // Test 2.14
  it('given_super_admin_role_when_execute_with_false_permissions_then_toAuthPermissions_still_all_true', async () => {
    const repo = makeRoleRepo({
      findById: mock(() => Promise.resolve(superAdminRole)),
      update: mock(() => Promise.resolve(superAdminRole)),
    })
    const useCase = new UpdateRoleUseCase(repo)
    const result = await useCase.execute('r-sa', {
      permissions: [{ module: AppModule.EMPLOYEES, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false }],
    })
    const perms = result.toAuthPermissions()
    const empPerm = perms.find(p => p.module === AppModule.EMPLOYEES)
    expect(empPerm?.canView).toBe(true)
  })
})
