import { describe, it, expect } from 'bun:test'
import { Role } from '../../domain/role'
import { AppModule } from '../../contracts/roles'
import { DomainError } from '../../domain/errors'

describe('Role entity', () => {
  // Test 1.1
  it('given_role_with_super_admin_name_when_toAuthPermissions_then_all_are_true', () => {
    const role = new Role({
      id: 'r1',
      name: 'super_admin',
      isSystem: true,
      permissions: [],
    })

    const perms = role.toAuthPermissions()

    expect(perms).toHaveLength(Object.values(AppModule).length)
    for (const perm of perms) {
      expect(perm.canView).toBe(true)
      expect(perm.canCreate).toBe(true)
      expect(perm.canEdit).toBe(true)
      expect(perm.canDelete).toBe(true)
      expect(perm.canExport).toBe(true)
    }
  })

  // Test 1.2
  it('given_non_super_admin_role_when_toAuthPermissions_then_returns_stored_permissions', () => {
    const role = new Role({
      id: 'r2',
      name: 'hr_manager',
      isSystem: true,
      permissions: [
        { module: AppModule.EMPLOYEES, canView: true, canCreate: true, canEdit: false, canDelete: false, canExport: false },
        { module: AppModule.PAYROLL, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false },
      ],
    })

    const perms = role.toAuthPermissions()
    const employees = perms.find(p => p.module === AppModule.EMPLOYEES)
    const payroll = perms.find(p => p.module === AppModule.PAYROLL)

    expect(employees?.canView).toBe(true)
    expect(employees?.canCreate).toBe(true)
    expect(employees?.canEdit).toBe(false)
    expect(payroll?.canView).toBe(false)
  })

  // Test 1.3
  it('given_system_role_when_rename_then_throws_DomainError', () => {
    const role = new Role({ id: 'r3', name: 'hr_manager', isSystem: true, permissions: [] })
    expect(() => role.rename('new_name')).toThrow(DomainError)
  })

  // Test 1.4
  it('given_system_role_when_assertCanDelete_then_throws_DomainError', () => {
    const role = new Role({ id: 'r4', name: 'finance', isSystem: true, permissions: [] })
    expect(() => role.assertCanDelete()).toThrow(DomainError)
  })

  // Test 1.5
  it('given_super_admin_role_with_stored_false_permissions_when_toAuthPermissions_then_invariant_overrides_to_true', () => {
    const role = new Role({
      id: 'r5',
      name: 'super_admin',
      isSystem: true,
      permissions: [
        { module: AppModule.EMPLOYEES, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false },
      ],
    })

    const perms = role.toAuthPermissions()
    const employees = perms.find(p => p.module === AppModule.EMPLOYEES)

    expect(employees?.canView).toBe(true)
    expect(employees?.canCreate).toBe(true)
  })

  // Test 1.8 — frozen contract
  it('AppModule_enum_values_match_expected_strings', () => {
    expect(AppModule.DASHBOARD).toBe('dashboard')
    expect(AppModule.EMPLOYEES).toBe('employees')
    expect(AppModule.ATTENDANCE).toBe('attendance')
    expect(AppModule.PAYROLL).toBe('payroll')
    expect(AppModule.REPORTS).toBe('reports')
    expect(AppModule.SETTINGS).toBe('settings')
    expect(AppModule.DOCUMENTS).toBe('documents')
    expect(AppModule.ABSENCES).toBe('absences')
    expect(AppModule.BENEFITS).toBe('benefits')
    expect(AppModule.RECRUITMENT).toBe('recruitment')
    expect(AppModule.NOTIFICATIONS).toBe('notifications')
    expect(Object.values(AppModule)).toHaveLength(11)
  })
})
