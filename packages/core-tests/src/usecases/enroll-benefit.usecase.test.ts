import { describe, it, expect, mock } from 'bun:test'
import { EnrollBenefitUseCase } from '@hrms/core/usecases/enroll-benefit.usecase'
import { ConflictError, NotFoundError, ValidationError } from '@hrms/core/domain/errors'
import type { EnrollBenefitRepository, BenefitPlanData, EmployeeBenefitData } from '@hrms/core/contracts/benefits'

const activePlan: BenefitPlanData = {
  id: 'p-1', name: 'Health', type: 'health', description: null,
  provider: null, cost: null, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
}
const inactivePlan: BenefitPlanData = { ...activePlan, isActive: false }
const enrollment: EmployeeBenefitData = {
  id: 'enr-1', employeeId: 'e-1', planId: 'p-1', enrolledAt: '2026-01-01', unenrolledAt: null,
}

function makeRepo(overrides: Partial<EnrollBenefitRepository> = {}): EnrollBenefitRepository {
  return {
    findById:       mock(() => Promise.resolve(activePlan)),
    findEnrollment: mock(() => Promise.resolve(null)),
    enroll:         mock(() => Promise.resolve(enrollment)),
    ...overrides,
  }
}

describe('EnrollBenefitUseCase', () => {
  // Test 2.10
  it('given_active_plan_and_no_existing_enrollment_when_enroll_then_creates_enrollment', async () => {
    const useCase = new EnrollBenefitUseCase(makeRepo())
    const result = await useCase.execute({ employeeId: 'e-1', planId: 'p-1', enrolledAt: '2026-01-01' })
    expect(result.planId).toBe('p-1')
    expect(result.unenrolledAt).toBeNull()
  })

  // Test 2.11
  it('given_inactive_plan_when_enroll_then_throws_ValidationError', async () => {
    const repo = makeRepo({ findById: mock(() => Promise.resolve(inactivePlan)) })
    const useCase = new EnrollBenefitUseCase(repo)
    await expect(useCase.execute({ employeeId: 'e-1', planId: 'p-1', enrolledAt: '2026-01-01' })).rejects.toThrow(ValidationError)
  })

  // Test 2.12
  it('given_active_enrollment_already_exists_when_enroll_then_throws_ConflictError', async () => {
    const repo = makeRepo({ findEnrollment: mock(() => Promise.resolve(enrollment)) })
    const useCase = new EnrollBenefitUseCase(repo)
    await expect(useCase.execute({ employeeId: 'e-1', planId: 'p-1', enrolledAt: '2026-06-01' })).rejects.toThrow(ConflictError)
  })
})
