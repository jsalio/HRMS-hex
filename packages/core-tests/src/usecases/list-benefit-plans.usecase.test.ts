import { describe, it, expect, mock } from 'bun:test'
import { ListBenefitPlansUseCase } from '@hrms/core/usecases/list-benefit-plans.usecase'
import type { IBenefitRepository, BenefitPlanData } from '@hrms/core/contracts/benefits'

const plan1: BenefitPlanData = {
  id: 'p-1', name: 'Health', type: 'health', description: null,
  provider: null, cost: null, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}
const plan2: BenefitPlanData = {
  id: 'p-2', name: 'Dental', type: 'dental', description: null,
  provider: null, cost: null, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}

function makeRepo(overrides: Partial<IBenefitRepository> = {}): IBenefitRepository {
  return {
    findAll:        mock(() => Promise.resolve([plan1, plan2])),
    findById:       mock(() => Promise.resolve(null)),
    findByName:     mock(() => Promise.resolve(null)),
    create:         mock(() => Promise.resolve(plan1)),
    update:         mock(() => Promise.resolve(plan1)),
    findByEmployee: mock(() => Promise.resolve([])),
    findEnrollment: mock(() => Promise.resolve(null)),
    enroll:         mock(() => Promise.resolve({ id: 'e-1', employeeId: 'emp-1', planId: 'p-1', enrolledAt: '2026-01-01', unenrolledAt: null })),
    unenroll:       mock(() => Promise.resolve({ id: 'e-1', employeeId: 'emp-1', planId: 'p-1', enrolledAt: '2026-01-01', unenrolledAt: '2026-06-18' })),
    ...overrides,
  }
}

describe('ListBenefitPlansUseCase', () => {
  // Test 2.1
  it('given_existing_plans_when_execute_then_returns_all_plans', async () => {
    const useCase = new ListBenefitPlansUseCase(makeRepo())
    const result = await useCase.execute()
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('p-1')
  })
})
