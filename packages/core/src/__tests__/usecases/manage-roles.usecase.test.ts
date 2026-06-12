import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { ManageRolesUseCase } from '../../usecases/manage-roles.usecase'
import { Role } from '../../domain/role'
import { AppModule } from '../../contracts/roles'
import { DomainError, ConflictError } from '../../domain/errors'
import type { IRoleRepository } from '../../contracts/roles'

const systemRole = new Role({ id: 'r-sys', name: 'hr_manager', isSystem: true, permissions: [] })
const customRole = new Role({ id: 'r-cus', name: 'supervisor', isSystem: false, permissions: [] })
const superAdminRole = new Role({ id: 'r-sa', name: 'super_admin', isSystem: true, permissions: [] })

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

describe('ManageRolesUseCase', () => {
  let useCase: ManageRolesUseCase

  beforeEach(() => {
    useCase = new ManageRolesUseCase(makeRoleRepo())
  })

  // Test 2.11
  it('given_valid_role_data_when_createRole_then_returns_role', async () => {
    const result = await useCase.createRole({ name: 'supervisor', permissions: [] })
    expect(result.id).toBe('r-cus')
  })

  // Test 2.12
  it('given_duplicate_name_when_createRole_then_throws_ConflictError', async () => {
    const repo = makeRoleRepo({ findByName: mock(() => Promise.resolve(customRole)) })
    const uc = new ManageRolesUseCase(repo)
    await expect(uc.createRole({ name: 'supervisor', permissions: [] })).rejects.toThrow(ConflictError)
  })

  // Test 2.13
  it('given_system_role_when_deleteRole_then_throws_DomainError', async () => {
    const repo = makeRoleRepo({ findById: mock(() => Promise.resolve(systemRole)) })
    const uc = new ManageRolesUseCase(repo)
    await expect(uc.deleteRole('r-sys')).rejects.toThrow(DomainError)
  })

  // Test 2.14
  it('given_super_admin_role_when_updateRole_with_false_permissions_then_toAuthPermissions_still_all_true', async () => {
    const repo = makeRoleRepo({
      findById: mock(() => Promise.resolve(superAdminRole)),
      update: mock(() => Promise.resolve(superAdminRole)),
    })
    const uc = new ManageRolesUseCase(repo)
    const result = await uc.updateRole('r-sa', {
      permissions: [{ module: AppModule.EMPLOYEES, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false }],
    })
    const perms = result.toAuthPermissions()
    const empPerm = perms.find(p => p.module === AppModule.EMPLOYEES)
    expect(empPerm?.canView).toBe(true)
  })
})
