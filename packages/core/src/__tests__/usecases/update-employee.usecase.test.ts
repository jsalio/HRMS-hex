import { describe, it, expect, mock } from 'bun:test'
import { UpdateEmployeeUseCase } from '../../usecases/update-employee.usecase'
import { ValidationError } from '../../domain/errors'
import type { IEmployeeRepository, IDepartmentRepository, EmployeeDetail } from '../../contracts/employees'

const now = new Date('2026-01-01T00:00:00Z')
const hireDate = new Date('2025-01-15T00:00:00Z')

const mockDept = { id: 'dept-1', name: 'Engineering', createdAt: now }

const mockEmployeeDetail: EmployeeDetail = {
  id: 'emp-1',
  fullName: 'Ana García',
  documentId: 'DNI-001',
  corporateEmail: 'ana@hrms.com',
  department: { id: 'dept-1', name: 'Engineering' },
  jobTitle: 'Developer',
  salary: 5000,
  status: 'ACTIVE',
  hireDate,
  terminationDate: null,
  createdAt: now,
  updatedAt: now,
  onboarding: [
    { id: 'ob-1', employeeId: 'emp-1', step: 'documents',  completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-2', employeeId: 'emp-1', step: 'equipment',  completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-3', employeeId: 'emp-1', step: 'training',   completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-4', employeeId: 'emp-1', step: 'access',     completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-5', employeeId: 'emp-1', step: 'complete',   completed: false, completedAt: null, notes: null, createdAt: now },
  ],
}

function makeRepos() {
  const employeeRepo: IEmployeeRepository = {
    findAll:              mock(async () => ({ data: [], total: 0, page: 1 })),
    findById:             mock(async () => mockEmployeeDetail),
    findByEmail:          mock(async () => null),
    findByDocumentId:     mock(async () => null),
    create:               mock(async () => mockEmployeeDetail),
    update:               mock(async () => ({ ...mockEmployeeDetail, onboarding: undefined } as any)),
    terminate:            mock(async () => ({ ...mockEmployeeDetail, status: 'INACTIVE' as const, onboarding: undefined } as any)),
    findOnboarding:       mock(async () => mockEmployeeDetail.onboarding),
    updateOnboardingStep: mock(async () => mockEmployeeDetail.onboarding[0]),
  }

  const deptRepo: IDepartmentRepository = {
    findAll:    mock(async () => [mockDept]),
    findById:   mock(async () => mockDept),
    findByName: mock(async () => null),
    create:     mock(async () => mockDept),
  }

  return { employeeRepo, deptRepo }
}

describe('UpdateEmployeeUseCase', () => {
  it('throws ValidationError when employee is INACTIVE', async () => {
    const { employeeRepo, deptRepo } = makeRepos()
    ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockEmployeeDetail, status: 'INACTIVE' })
    const uc = new UpdateEmployeeUseCase(employeeRepo, deptRepo)

    await expect(
      uc.execute('emp-1', { jobTitle: 'Senior Dev' })
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
