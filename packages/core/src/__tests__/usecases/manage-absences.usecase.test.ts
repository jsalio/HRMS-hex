import { describe, it, expect, mock } from 'bun:test'
import { ManageAbsencesUseCase } from '../../usecases/manage-absences.usecase'
import { NotFoundError, ValidationError } from '../../domain/errors'
import type { IAbsenceRepository, AbsenceRequestData, AbsenceBalanceData, AbsenceTypeData } from '../../contracts/absences'
import type { IEmployeeRepository } from '../../contracts/employees'

const now = new Date('2026-01-01T00:00:00Z')

const mockEmployee = {
  id: 'emp-1', fullName: 'Ana García', documentId: 'DNI-001',
  corporateEmail: 'ana@hrms.com', department: { id: 'd-1', name: 'HR' },
  jobTitle: 'Manager', salary: 5000, status: 'ACTIVE' as const,
  hireDate: now, terminationDate: null, createdAt: now, updatedAt: now, onboarding: [],
}

const mockType: AbsenceTypeData = {
  id: 'type-vac', name: 'vacation', annualAllowanceDays: 15,
  requiresApproval: true, createdAt: now,
}

const mockBalance: AbsenceBalanceData = {
  id: 'bal-1', employeeId: 'emp-1', absenceTypeId: 'type-vac',
  year: 2026, allocatedDays: 15, usedDays: 0, pendingDays: 0,
}

const mockRequest: AbsenceRequestData = {
  id: 'req-1', employeeId: 'emp-1', absenceTypeId: 'type-vac',
  startDate: '2026-07-14', endDate: '2026-07-18', workingDays: 5,
  reason: null, status: 'PENDING', reviewedBy: null, reviewedAt: null,
  reviewNotes: null, createdAt: now, updatedAt: now,
}

function makeRepos() {
  const absenceRepo: IAbsenceRepository = {
    findAbsenceTypes:      mock(async () => [mockType]),
    findAbsenceTypeById:   mock(async () => mockType),
    findBalancesByEmployee: mock(async () => [mockBalance]),
    findOrCreateBalance:   mock(async () => mockBalance),
    reservePendingDays:    mock(async () => ({ ...mockBalance, pendingDays: 5 })),
    releasePendingDays:    mock(async () => ({ ...mockBalance, pendingDays: 0 })),
    approveBalance:        mock(async () => ({ ...mockBalance, usedDays: 5, pendingDays: 0 })),
    findRequests:          mock(async () => ({ data: [mockRequest], total: 1 })),
    findRequestById:       mock(async () => mockRequest),
    findOverlapping:       mock(async () => []),
    createRequest:         mock(async () => mockRequest),
    updateRequestStatus:   mock(async (_id, status) => ({ ...mockRequest, status })),
  }
  const employeeRepo: IEmployeeRepository = {
    findAll:             mock(async () => ({ data: [], total: 0, page: 1, limit: 20 })),
    findById:            mock(async () => mockEmployee),
    findByEmail:         mock(async () => null),
    findByDocumentId:    mock(async () => null),
    create:              mock(async () => mockEmployee),
    update:              mock(async () => mockEmployee),
    terminate:           mock(async () => mockEmployee),
    findOnboarding:      mock(async () => []),
    updateOnboardingStep: mock(async () => ({ id: 's-1', step: 'documents' as const, completed: true, completedAt: now, notes: null })),
  }
  return { absenceRepo, employeeRepo }
}

describe('ManageAbsencesUseCase', () => {
  describe('requestAbsence', () => {
    it('creates_PENDING_request_and_reserves_balance_for_active_employee', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      const result = await uc.requestAbsence({
        employeeId: 'emp-1', absenceTypeId: 'type-vac',
        startDate: '2026-07-14', endDate: '2026-07-18',
        requesterId: 'emp-1',
      })
      expect(result.status).toBe('PENDING')
      expect(absenceRepo.reservePendingDays).toHaveBeenCalled()
    })

    it('throws_NotFoundError_when_employee_not_found', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      ;(employeeRepo.findById as any).mockImplementation(async () => null)
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.requestAbsence({
        employeeId: 'ghost', absenceTypeId: 'type-vac',
        startDate: '2026-07-14', endDate: '2026-07-18', requesterId: 'ghost',
      })).rejects.toThrow(NotFoundError)
    })

    it('throws_ValidationError_when_employee_is_INACTIVE', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      ;(employeeRepo.findById as any).mockImplementation(async () => ({ ...mockEmployee, status: 'INACTIVE' }))
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.requestAbsence({
        employeeId: 'emp-1', absenceTypeId: 'type-vac',
        startDate: '2026-07-14', endDate: '2026-07-18', requesterId: 'emp-1',
      })).rejects.toThrow(ValidationError)
    })

    it('throws_ValidationError_when_balance_insufficient', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      ;(absenceRepo.findOrCreateBalance as any).mockImplementation(async () => ({
        ...mockBalance, allocatedDays: 3, usedDays: 0, pendingDays: 0,
      }))
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.requestAbsence({
        employeeId: 'emp-1', absenceTypeId: 'type-vac',
        startDate: '2026-07-14', endDate: '2026-07-18', requesterId: 'emp-1',
      })).rejects.toThrow(ValidationError)
    })

    it('throws_ValidationError_when_dates_overlap_existing_request', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      ;(absenceRepo.findOverlapping as any).mockImplementation(async () => [mockRequest])
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.requestAbsence({
        employeeId: 'emp-1', absenceTypeId: 'type-vac',
        startDate: '2026-07-14', endDate: '2026-07-18', requesterId: 'emp-1',
      })).rejects.toThrow(ValidationError)
    })
  })

  describe('approveAbsence', () => {
    it('moves_pending_days_to_used_and_sets_APPROVED', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      const result = await uc.approveAbsence('req-1', 'reviewer-1', 'Approved')
      expect(result.status).toBe('APPROVED')
      expect(absenceRepo.approveBalance).toHaveBeenCalled()
    })

    it('throws_ValidationError_when_request_is_not_PENDING', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      ;(absenceRepo.findRequestById as any).mockImplementation(async () => ({ ...mockRequest, status: 'APPROVED' }))
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.approveAbsence('req-1', 'reviewer-1')).rejects.toThrow(ValidationError)
    })
  })

  describe('rejectAbsence', () => {
    it('releases_pending_days_and_sets_REJECTED', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      const result = await uc.rejectAbsence('req-1', 'reviewer-1', 'Not justified')
      expect(result.status).toBe('REJECTED')
      expect(absenceRepo.releasePendingDays).toHaveBeenCalled()
    })
  })

  describe('cancelAbsence', () => {
    it('releases_pending_days_and_sets_CANCELLED', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      const result = await uc.cancelAbsence('req-1', 'emp-1')
      expect(result.status).toBe('CANCELLED')
      expect(absenceRepo.releasePendingDays).toHaveBeenCalled()
    })

    it('throws_ValidationError_when_requesting_employee_is_not_owner', async () => {
      const { absenceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAbsencesUseCase(absenceRepo, employeeRepo)
      await expect(uc.cancelAbsence('req-1', 'emp-OTHER')).rejects.toThrow(ValidationError)
    })
  })
})
