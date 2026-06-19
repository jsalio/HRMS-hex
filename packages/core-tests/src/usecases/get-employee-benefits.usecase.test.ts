import { describe, it, expect, mock } from 'bun:test'
import { GetEmployeeBenefitsUseCase } from '@hrms/core/usecases/get-employee-benefits.usecase'
import { ForbiddenError } from '@hrms/core/domain/errors'
import type { GetEmployeeBenefitsRepository, EmployeeBenefitData } from '@hrms/core/contracts/benefits'

const enrollment: EmployeeBenefitData = {
  id: 'enr-1', employeeId: 'e-1', planId: 'p-1',
  enrolledAt: '2026-01-01', unenrolledAt: null,
}

function makeRepo(overrides: Partial<GetEmployeeBenefitsRepository> = {}): GetEmployeeBenefitsRepository {
  return {
    findByEmployee: mock(() => Promise.resolve([enrollment])),
    ...overrides,
  }
}

describe('GetEmployeeBenefitsUseCase', () => {
  // Test 2.7
  it('given_owner_employee_when_get_own_benefits_then_returns_results', async () => {
    const useCase = new GetEmployeeBenefitsUseCase(makeRepo())
    const result = await useCase.execute({ employeeId: 'e-1', requestingUserId: 'e-1', requestingUserRole: 'employee' })
    expect(result).toHaveLength(1)
    expect(result[0].planId).toBe('p-1')
  })

  // Test 2.8
  it('given_hr_manager_role_when_get_employee_benefits_then_returns_results', async () => {
    const useCase = new GetEmployeeBenefitsUseCase(makeRepo())
    const result = await useCase.execute({ employeeId: 'e-1', requestingUserId: 'e-2', requestingUserRole: 'hr_manager' })
    expect(result).toHaveLength(1)
  })

  // Test 2.9
  it('given_non_owner_employee_when_get_employee_benefits_then_throws_ForbiddenError', async () => {
    const useCase = new GetEmployeeBenefitsUseCase(makeRepo())
    await expect(
      useCase.execute({ employeeId: 'e-1', requestingUserId: 'e-2', requestingUserRole: 'employee' })
    ).rejects.toThrow(ForbiddenError)
  })
})
