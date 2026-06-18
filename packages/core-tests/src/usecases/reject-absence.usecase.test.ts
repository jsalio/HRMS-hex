import { describe, it, expect, mock } from 'bun:test'
import { RejectAbsenceUseCase } from '@hrms/core/usecases/reject-absence.usecase'
import type { IAbsenceRepository, AbsenceRequestData, AbsenceBalanceData, AbsenceTypeData } from '@hrms/core/contracts/absences'

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

describe('RejectAbsenceUseCase', () => {
  it('releases_pending_days_and_sets_REJECTED', async () => {
    const absenceRepo = makeRepo()
    const uc = new RejectAbsenceUseCase(absenceRepo)
    const result = await uc.execute('req-1', 'reviewer-1', 'Not justified')
    expect(result.status).toBe('REJECTED')
    expect(absenceRepo.releasePendingDays).toHaveBeenCalled()
  })
})
