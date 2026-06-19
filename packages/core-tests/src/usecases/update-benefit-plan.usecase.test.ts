import { describe, it, expect, mock } from 'bun:test'
import { UpdateBenefitPlanUseCase } from '@hrms/core/usecases/update-benefit-plan.usecase'
import { NotFoundError } from '@hrms/core/domain/errors'
import type { UpdateBenefitPlanRepository, BenefitPlanData } from '@hrms/core/contracts/benefits'

const planData: BenefitPlanData = {
  id: 'p-1', name: 'Health', type: 'health', description: null,
  provider: null, cost: null, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}

const inactivePlan: BenefitPlanData = { ...planData, isActive: false }

function makeRepo(overrides: Partial<UpdateBenefitPlanRepository> = {}): UpdateBenefitPlanRepository {
  return {
    findById: mock(() => Promise.resolve(planData)),
    update:   mock(() => Promise.resolve(inactivePlan)),
    ...overrides,
  }
}

describe('UpdateBenefitPlanUseCase', () => {
  // Test 2.5
  it('given_existing_plan_when_update_then_returns_updated_plan', async () => {
    const useCase = new UpdateBenefitPlanUseCase(makeRepo())
    const result = await useCase.execute('p-1', { isActive: false })
    expect(result.isActive).toBe(false)
  })

  // Test 2.6
  it('given_unknown_plan_id_when_update_then_throws_NotFoundError', async () => {
    const repo = makeRepo({ findById: mock(() => Promise.resolve(null)) })
    const useCase = new UpdateBenefitPlanUseCase(repo)
    await expect(useCase.execute('nonexistent', { isActive: false })).rejects.toThrow(NotFoundError)
  })
})
