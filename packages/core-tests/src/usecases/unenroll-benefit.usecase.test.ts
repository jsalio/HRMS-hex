import { describe, it, expect, mock } from 'bun:test'
import { UnenrollBenefitUseCase } from '@hrms/core/usecases/unenroll-benefit.usecase'
import { NotFoundError } from '@hrms/core/domain/errors'
import type { UnenrollBenefitRepository, EmployeeBenefitData } from '@hrms/core/contracts/benefits'

const enrollment: EmployeeBenefitData = {
  id: 'enr-1', employeeId: 'e-1', planId: 'p-1', enrolledAt: '2026-01-01', unenrolledAt: null,
}
const unenrolled: EmployeeBenefitData = { ...enrollment, unenrolledAt: '2026-06-18' }

function makeRepo(overrides: Partial<UnenrollBenefitRepository> = {}): UnenrollBenefitRepository {
  return {
    findEnrollment: mock(() => Promise.resolve(enrollment)),
    unenroll:       mock(() => Promise.resolve(unenrolled)),
    ...overrides,
  }
}

describe('UnenrollBenefitUseCase', () => {
  // Test 2.13
  it('given_existing_enrollment_when_unenroll_then_returns_enrollment_with_unenrolled_at', async () => {
    const useCase = new UnenrollBenefitUseCase(makeRepo())
    const result = await useCase.execute({ employeeId: 'e-1', planId: 'p-1', unenrolledAt: '2026-06-18' })
    expect(result.unenrolledAt).toBe('2026-06-18')
  })

  // Test 2.14
  it('given_no_enrollment_found_when_unenroll_then_throws_NotFoundError', async () => {
    const repo = makeRepo({ findEnrollment: mock(() => Promise.resolve(null)) })
    const useCase = new UnenrollBenefitUseCase(repo)
    await expect(useCase.execute({ employeeId: 'e-1', planId: 'p-1', unenrolledAt: '2026-06-18' })).rejects.toThrow(NotFoundError)
  })
})
