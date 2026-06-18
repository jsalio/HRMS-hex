import { describe, it, expect, mock } from 'bun:test'
import { TerminateEmployeeUseCase } from '../../usecases/terminate-employee.usecase'
import { ValidationError } from '../../domain/errors'
import type { IEmployeeRepository, EmployeeDetail } from '../../contracts/employees'
import type { IUserRepository, IRefreshTokenRepository } from '../../contracts/auth'

const now = new Date('2026-01-01T00:00:00Z')
const hireDate = new Date('2025-01-15T00:00:00Z')

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

  const userRepo: IUserRepository = {
    findByEmail:     mock(async () => null),
    findById:        mock(async () => null),
    create:          mock(async () => ({ id: 'user-1', email: 'ana@hrms.com', passwordHash: 'x', isActive: true, roleId: 'role-1', employeeId: 'emp-1', lastLoginAt: null })),
    deactivate:      mock(async () => ({} as any)),
    setEmployee:     mock(async () => {}),
    updateLastLogin: mock(async () => {}),
  }

  const refreshTokenRepo: IRefreshTokenRepository = {
    create:           mock(async () => {}),
    findByHash:       mock(async () => null),
    revoke:           mock(async () => {}),
    revokeAllForUser: mock(async () => {}),
  }

  return { employeeRepo, userRepo, refreshTokenRepo }
}

describe('TerminateEmployeeUseCase', () => {
  it('returns employee with INACTIVE status', async () => {
    const { employeeRepo, userRepo, refreshTokenRepo } = makeRepos()
    const uc = new TerminateEmployeeUseCase(employeeRepo, userRepo, refreshTokenRepo)

    await uc.execute('emp-1', new Date('2026-06-01'))

    expect(employeeRepo.terminate).toHaveBeenCalledWith('emp-1', new Date('2026-06-01'))
  })

  it('deactivates associated user account', async () => {
    const { employeeRepo, userRepo, refreshTokenRepo } = makeRepos()
    ;(userRepo.findByEmail as ReturnType<typeof mock>).mockResolvedValue({
      id: 'user-1', email: 'ana@hrms.com', passwordHash: 'x',
      isActive: true, roleId: 'role-1', employeeId: 'emp-1', lastLoginAt: null,
    })
    const uc = new TerminateEmployeeUseCase(employeeRepo, userRepo, refreshTokenRepo)

    await uc.execute('emp-1', new Date('2026-06-01'))

    expect(userRepo.deactivate).toHaveBeenCalledWith('user-1')
    expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1')
  })

  it('throws ValidationError when employee is already INACTIVE', async () => {
    const { employeeRepo, userRepo, refreshTokenRepo } = makeRepos()
    ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockEmployeeDetail, status: 'INACTIVE' })
    const uc = new TerminateEmployeeUseCase(employeeRepo, userRepo, refreshTokenRepo)

    await expect(
      uc.execute('emp-1', new Date('2026-06-01'))
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
