import { describe, it, expect } from 'bun:test'
import { AbsenceBalance, assertCanApprove, assertCanReject, assertCanCancel, calculateWorkingDays } from '../../domain/absence-balance'
import { ValidationError } from '../../domain/errors'
import type { AbsenceBalanceData, AbsenceRequestData } from '../../contracts/absences'

function makeBalance(overrides: Partial<AbsenceBalanceData> = {}): AbsenceBalanceData {
  return {
    id: 'bal-1', employeeId: 'emp-1', absenceTypeId: 'type-1',
    year: 2026, allocatedDays: 15, usedDays: 0, pendingDays: 0,
    ...overrides,
  }
}

function makePendingRequest(overrides: Partial<AbsenceRequestData> = {}): AbsenceRequestData {
  return {
    id: 'req-1', employeeId: 'emp-1', absenceTypeId: 'type-1',
    startDate: '2026-07-01', endDate: '2026-07-03', workingDays: 3,
    reason: null, status: 'PENDING', reviewedBy: null, reviewedAt: null,
    reviewNotes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('AbsenceBalance', () => {
  it('assertHasSufficientBalance_passes_when_days_available', () => {
    const balance = new AbsenceBalance(makeBalance({ allocatedDays: 15, usedDays: 2, pendingDays: 1 }))
    expect(() => balance.assertHasSufficientBalance(5)).not.toThrow()
  })

  it('assertHasSufficientBalance_throws_when_days_insufficient', () => {
    const balance = new AbsenceBalance(makeBalance({ allocatedDays: 5, usedDays: 3, pendingDays: 1 }))
    expect(() => balance.assertHasSufficientBalance(3)).toThrow(ValidationError)
  })

  it('availableDays_is_allocated_minus_used_minus_pending', () => {
    const balance = new AbsenceBalance(makeBalance({ allocatedDays: 15, usedDays: 4, pendingDays: 3 }))
    expect(balance.availableDays).toBe(8)
  })
})

describe('assertCanApprove', () => {
  it('passes_when_PENDING', () => {
    expect(() => assertCanApprove(makePendingRequest())).not.toThrow()
  })

  it('throws_when_already_APPROVED', () => {
    expect(() => assertCanApprove(makePendingRequest({ status: 'APPROVED' }))).toThrow(ValidationError)
  })

  it('throws_when_CANCELLED', () => {
    expect(() => assertCanApprove(makePendingRequest({ status: 'CANCELLED' }))).toThrow(ValidationError)
  })
})

describe('assertCanCancel', () => {
  it('passes_when_PENDING_and_same_employee', () => {
    expect(() => assertCanCancel(makePendingRequest({ employeeId: 'emp-1' }), 'emp-1')).not.toThrow()
  })

  it('throws_when_different_employee', () => {
    expect(() => assertCanCancel(makePendingRequest({ employeeId: 'emp-1' }), 'emp-2')).toThrow(ValidationError)
  })

  it('throws_when_not_PENDING', () => {
    expect(() => assertCanCancel(makePendingRequest({ status: 'APPROVED' }), 'emp-1')).toThrow(ValidationError)
  })
})

describe('calculateWorkingDays', () => {
  it('counts_only_weekdays', () => {
    // 2026-06-15 Monday → 2026-06-19 Friday = 5 days
    expect(calculateWorkingDays('2026-06-15', '2026-06-19')).toBe(5)
  })

  it('excludes_weekend_days', () => {
    // 2026-06-13 Saturday → 2026-06-14 Sunday = 0 working days
    expect(calculateWorkingDays('2026-06-13', '2026-06-14')).toBe(0)
  })

  it('counts_single_weekday', () => {
    expect(calculateWorkingDays('2026-06-15', '2026-06-15')).toBe(1)
  })

  it('spans_weekend_correctly', () => {
    // Mon 15 → Fri 19 + Mon 22 → Fri 26 = 10 days, weekends excluded
    expect(calculateWorkingDays('2026-06-15', '2026-06-26')).toBe(10)
  })
})
