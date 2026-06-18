import { describe, it, expect, mock } from 'bun:test'
import { CancelAbsenceUseCase } from '../../usecases/cancel-absence.usecase'
import { ValidationError } from '../../domain/errors'
import type { IAbsenceRepository, AbsenceRequestData, AbsenceBalanceData, AbsenceTypeData } from '../../contracts/absences'

const now = new Date('2026-01-01T00:00:00Z')

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

function makeRepo(): IAbsenceRepository {
  return {
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
}

describe('CancelAbsenceUseCase', () => {
  it('releases_pending_days_and_sets_CANCELLED', async () => {
    const absenceRepo = makeRepo()
    const uc = new CancelAbsenceUseCase(absenceRepo)
    const result = await uc.execute('req-1', 'emp-1')
    expect(result.status).toBe('CANCELLED')
    expect(absenceRepo.releasePendingDays).toHaveBeenCalled()
  })

  it('throws_ValidationError_when_requesting_employee_is_not_owner', async () => {
    const absenceRepo = makeRepo()
    const uc = new CancelAbsenceUseCase(absenceRepo)
    await expect(uc.execute('req-1', 'emp-OTHER')).rejects.toThrow(ValidationError)
  })
})
