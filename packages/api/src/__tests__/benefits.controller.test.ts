import { describe, it, expect, mock } from 'bun:test'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-x'

import { Hono } from 'hono'
import { createBenefitsController } from '../controllers/benefits.controller'
import type {
  ListBenefitPlansUseCase, CreateBenefitPlanUseCase, UpdateBenefitPlanUseCase,
  GetEmployeeBenefitsUseCase, EnrollBenefitUseCase, UnenrollBenefitUseCase,
} from '@hrms/core'
import { AppModule, DomainError, ForbiddenError, NotFoundError, ConflictError, ValidationError } from '@hrms/core'
import type { BenefitPlanData, EmployeeBenefitData } from '@hrms/core'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode('test-secret-at-least-32-characters-x')

async function makeToken(
  sub: string,
  roleName: string,
  permissions: Array<{ module: AppModule; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean }>,
) {
  return new SignJWT({ sub, email: `${sub}@hrms.com`, role: { id: 'r1', name: roleName, permissions } })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret)
}

const allPerms = Object.values(AppModule).map(m => ({
  module: m, canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true,
}))

const noPerms = Object.values(AppModule).map(m => ({
  module: m, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false,
}))

const viewOnly = Object.values(AppModule).map(m => ({
  module: m, canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false,
}))

const planData: BenefitPlanData = {
  id: 'p-1', name: 'Health', type: 'health', description: null, provider: null,
  cost: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
}
const PLAN_UUID = '00000000-0000-0000-0000-000000000001'

const enrollmentData: EmployeeBenefitData = {
  id: 'enr-1', employeeId: 'e-1', planId: PLAN_UUID, enrolledAt: '2026-01-01', unenrolledAt: null,
}
const unenrolledData: EmployeeBenefitData = { ...enrollmentData, unenrolledAt: '2026-06-18' }

interface UCOverrides {
  listBenefitPlans?: () => Promise<unknown>
  createBenefitPlan?: () => Promise<unknown>
  updateBenefitPlan?: () => Promise<unknown>
  getEmployeeBenefits?: () => Promise<unknown>
  enrollBenefit?: () => Promise<unknown>
  unenrollBenefit?: () => Promise<unknown>
}

function buildApp(overrides: UCOverrides = {}) {
  const listBenefitPlans    = { execute: overrides.listBenefitPlans    ?? mock(() => Promise.resolve([planData])) } as unknown as ListBenefitPlansUseCase
  const createBenefitPlan   = { execute: overrides.createBenefitPlan   ?? mock(() => Promise.resolve(planData)) } as unknown as CreateBenefitPlanUseCase
  const updateBenefitPlan   = { execute: overrides.updateBenefitPlan   ?? mock(() => Promise.resolve(planData)) } as unknown as UpdateBenefitPlanUseCase
  const getEmployeeBenefits = { execute: overrides.getEmployeeBenefits ?? mock(() => Promise.resolve([enrollmentData])) } as unknown as GetEmployeeBenefitsUseCase
  const enrollBenefit       = { execute: overrides.enrollBenefit       ?? mock(() => Promise.resolve(enrollmentData)) } as unknown as EnrollBenefitUseCase
  const unenrollBenefit     = { execute: overrides.unenrollBenefit     ?? mock(() => Promise.resolve(unenrolledData)) } as unknown as UnenrollBenefitUseCase

  const ctrl = createBenefitsController(
    listBenefitPlans, createBenefitPlan, updateBenefitPlan,
    getEmployeeBenefits, enrollBenefit, unenrollBenefit,
  )
  const app = new Hono()
  app.route('/benefit-plans', ctrl.planRoutes)
  app.route('/employees',     ctrl.enrollmentRoutes)
  return app
}

describe('BenefitsController — /benefit-plans', () => {
  // Test 3.1
  it('given_user_with_benefits_view_permission_when_GET_benefit_plans_then_returns_200', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/benefit-plans', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
  })

  // Test 3.2
  it('given_user_without_benefits_view_permission_when_GET_benefit_plans_then_returns_403', async () => {
    const token = await makeToken('u-1', 'employee', noPerms)
    const res = await buildApp().request('/benefit-plans', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
  })

  // Test 3.3
  it('given_valid_plan_data_when_POST_benefit_plans_then_returns_201', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/benefit-plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Health', type: 'health' }),
    })
    expect(res.status).toBe(201)
  })

  // Test 3.4
  it('given_employee_role_when_POST_benefit_plans_then_returns_403', async () => {
    const token = await makeToken('u-1', 'employee', viewOnly)
    const res = await buildApp().request('/benefit-plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Health', type: 'health' }),
    })
    expect(res.status).toBe(403)
  })

  // Test 3.5
  it('given_duplicate_name_when_POST_benefit_plans_then_returns_409', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const app = buildApp({ createBenefitPlan: mock(() => Promise.reject(new ConflictError('Duplicate'))) })
    const res = await app.request('/benefit-plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Health', type: 'health' }),
    })
    expect(res.status).toBe(409)
  })

  // Test 3.6
  it('given_existing_plan_when_PATCH_benefit_plans_id_then_returns_200', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/benefit-plans/p-1', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.status).toBe(200)
  })

  // Test 3.7
  it('given_unknown_plan_when_PATCH_benefit_plans_id_then_returns_404', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const app = buildApp({ updateBenefitPlan: mock(() => Promise.reject(new NotFoundError('Not found'))) })
    const res = await app.request('/benefit-plans/unknown', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.status).toBe(404)
  })
})

describe('BenefitsController — /employees/:id/benefits', () => {
  // Test 3.8
  it('given_owner_employee_when_GET_employees_id_benefits_then_returns_200', async () => {
    const token = await makeToken('e-1', 'employee', viewOnly)
    const res = await buildApp().request('/employees/e-1/benefits', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
  })

  // Test 3.9
  it('given_non_owner_employee_when_GET_employees_id_benefits_then_returns_403', async () => {
    const token = await makeToken('e-2', 'employee', viewOnly)
    const app = buildApp({ getEmployeeBenefits: mock(() => Promise.reject(new ForbiddenError('Access denied'))) })
    const res = await app.request('/employees/e-1/benefits', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  // Test 3.10
  it('given_valid_enrollment_when_POST_employees_id_benefits_then_returns_201', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/employees/e-1/benefits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: PLAN_UUID, enrolled_at: '2026-01-01' }),
    })
    expect(res.status).toBe(201)
  })

  // Test 3.11
  it('given_inactive_plan_when_POST_employees_id_benefits_then_returns_422', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const app = buildApp({ enrollBenefit: mock(() => Promise.reject(new ValidationError('Plan inactive'))) })
    const res = await app.request('/employees/e-1/benefits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: PLAN_UUID, enrolled_at: '2026-01-01' }),
    })
    expect(res.status).toBe(422)
  })

  // Test 3.12
  it('given_already_enrolled_when_POST_employees_id_benefits_then_returns_409', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const app = buildApp({ enrollBenefit: mock(() => Promise.reject(new ConflictError('Already enrolled'))) })
    const res = await app.request('/employees/e-1/benefits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: PLAN_UUID, enrolled_at: '2026-01-01' }),
    })
    expect(res.status).toBe(409)
  })

  // Test 3.13
  it('given_existing_enrollment_when_DELETE_employees_id_benefits_planId_then_returns_200_with_unenrolled_at', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/employees/e-1/benefits/p-1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as EmployeeBenefitData
    expect(body.unenrolledAt).toBeTruthy()
  })
})
