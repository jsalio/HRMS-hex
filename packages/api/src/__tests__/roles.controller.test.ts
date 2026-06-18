import { describe, it, expect, mock } from 'bun:test'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-x'

import { Hono } from 'hono'
import { createRolesController } from '../controllers/roles.controller'
import type { ListRolesUseCase, CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase } from '@hrms/core'
import { Role, AppModule, DomainError } from '@hrms/core'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode('test-secret-at-least-32-characters-x')

async function makeToken(permissions: Array<{ module: AppModule; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean }>) {
  return new SignJWT({
    sub: 'u1',
    email: 'admin@hrms.com',
    role: { id: 'r1', name: 'hr_manager', permissions },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret)
}

const superAdminRole = new Role({ id: 'r-sa', name: 'super_admin', isSystem: true, permissions: [] })
const customRole = new Role({ id: 'r-c', name: 'supervisor', isSystem: false, permissions: [] })

interface UseCaseOverrides {
  listRoles?: () => Promise<unknown>
  createRole?: () => Promise<unknown>
  updateRole?: () => Promise<unknown>
  deleteRole?: () => Promise<unknown>
}

function buildApp(overrides: UseCaseOverrides = {}) {
  const listRoles  = { execute: overrides.listRoles  ?? mock(() => Promise.resolve([superAdminRole, customRole])) } as unknown as ListRolesUseCase
  const createRole = { execute: overrides.createRole ?? mock(() => Promise.resolve(customRole)) } as unknown as CreateRoleUseCase
  const updateRole = { execute: overrides.updateRole ?? mock(() => Promise.resolve(customRole)) } as unknown as UpdateRoleUseCase
  const deleteRole = { execute: overrides.deleteRole ?? mock(() => Promise.resolve()) } as unknown as DeleteRoleUseCase

  const app = new Hono()
  app.route('/roles', createRolesController(listRoles, createRole, updateRole, deleteRole))
  return app
}

const settingsViewPerms = Object.values(AppModule).map(m => ({
  module: m,
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canExport: true,
}))

const noPerms = Object.values(AppModule).map(m => ({
  module: m,
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canExport: false,
}))

describe('RolesController', () => {
  // Test 4.6
  it('given_user_without_settings_view_permission_when_GET_roles_then_returns_403', async () => {
    const token = await makeToken(noPerms)
    const app = buildApp()
    const res = await app.request('/roles', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  // Test 4.7
  it('given_super_admin_when_GET_roles_then_returns_200_with_role_list', async () => {
    const token = await makeToken(settingsViewPerms)
    const app = buildApp()
    const res = await app.request('/roles', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
  })

  // Test 4.8
  it('given_system_role_id_when_DELETE_roles_id_then_returns_422', async () => {
    const token = await makeToken(settingsViewPerms)
    const app = buildApp({ deleteRole: mock(() => Promise.reject(new DomainError('Cannot delete system role'))) })
    const res = await app.request('/roles/r-sys', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(422)
  })
})
