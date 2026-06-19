import { describe, it, expect, mock } from 'bun:test'
import { CreateBenefitPlanUseCase } from '@hrms/core/usecases/create-benefit-plan.usecase'
import { ConflictError, ValidationError } from '@hrms/core/domain/errors'
import type { CreateBenefitPlanRepository, BenefitPlanData } from '@hrms/core/contracts/benefits'

const planData: BenefitPlanData = {
  id: 'p-1', name: 'Health', type: 'health', description: null,
  provider: null, cost: null, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}

function makeRepo(overrides: Partial<CreateBenefitPlanRepository> = {}): CreateBenefitPlanRepository {
  return {
    findByName: mock(() => Promise.resolve(null)),
    create:     mock(() => Promise.resolve(planData)),
    ...overrides,
  }
}

describe('CreateBenefitPlanUseCase', () => {
  // Test 2.2
  it('given_unique_name_when_create_then_returns_created_plan', async () => {
    const useCase = new CreateBenefitPlanUseCase(makeRepo())
    const result = await useCase.execute({ name: 'Health', type: 'health' })
    expect(result.id).toBe('p-1')
    expect(result.name).toBe('Health')
  })

  // Test 2.3
  it('given_duplicate_name_when_create_then_throws_ConflictError', async () => {
    const repo = makeRepo({ findByName: mock(() => Promise.resolve(planData)) })
    const useCase = new CreateBenefitPlanUseCase(repo)
    await expect(useCase.execute({ name: 'Health', type: 'health' })).rejects.toThrow(ConflictError)
  })

  // Test 2.4
  it('given_invalid_type_when_create_then_throws_ValidationError', async () => {
    const useCase = new CreateBenefitPlanUseCase(makeRepo())
    await expect(useCase.execute({ name: 'Test', type: 'invalid_type' as any })).rejects.toThrow(ValidationError)
  })
})
