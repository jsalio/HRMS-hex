import { describe, it, expect, mock } from 'bun:test'
import { ApproveAbsenceUseCase } from '@hrms/core/usecases/approve-absence.usecase'
import { ValidationError } from '@hrms/core/domain/errors'
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

describe('ApproveAbsenceUseCase', () => {
  it('moves_pending_days_to_used_and_sets_APPROVED', async () => {
    const absenceRepo = makeRepo()
    const uc = new ApproveAbsenceUseCase(absenceRepo)
    const result = await uc.execute('req-1', 'reviewer-1', 'Approved')
    expect(result.status).toBe('APPROVED')
    expect(absenceRepo.approveBalance).toHaveBeenCalled()
  })

  it('throws_ValidationError_when_request_is_not_PENDING', async () => {
    const absenceRepo = makeRepo()
    ;(absenceRepo.findRequestById as any).mockImplementation(async () => ({ ...mockRequest, status: 'APPROVED' }))
    const uc = new ApproveAbsenceUseCase(absenceRepo)
    await expect(uc.execute('req-1', 'reviewer-1')).rejects.toThrow(ValidationError)
  })
})
