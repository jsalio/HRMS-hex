import { describe, it, expect } from 'bun:test'
import { AttendanceRecord, assertNoExistingCheckIn, toDateString } from '@hrms/core/domain/attendance-record'
import { ValidationError, ConflictError } from '@hrms/core/domain/errors'
import type { AttendanceRecordData } from '@hrms/core/contracts/attendance'

const now = new Date('2026-06-14T09:00:00Z')

function makeRecord(overrides: Partial<AttendanceRecordData> = {}): AttendanceRecordData {
  return {
    id: 'rec-1', employeeId: 'emp-1', date: '2026-06-14',
    checkIn: now, checkOut: null, hoursWorked: null,
    status: 'PRESENT', notes: null, createdAt: now, updatedAt: now,
    ...overrides,
  }
}

describe('AttendanceRecord', () => {
  it('assertCanCheckOut_passes_when_timestamp_after_checkIn', () => {
    const rec = new AttendanceRecord(makeRecord({ checkIn: now }))
    const later = new Date(now.getTime() + 3600_000)
    expect(() => rec.assertCanCheckOut(later)).not.toThrow()
  })

  it('assertCanCheckOut_throws_when_no_checkIn', () => {
    const rec = new AttendanceRecord(makeRecord({ checkIn: null }))
    expect(() => rec.assertCanCheckOut(now)).toThrow(ValidationError)
  })

  it('assertCanCheckOut_throws_when_timestamp_before_checkIn', () => {
    const rec = new AttendanceRecord(makeRecord({ checkIn: now }))
    const earlier = new Date(now.getTime() - 1000)
    expect(() => rec.assertCanCheckOut(earlier)).toThrow(ValidationError)
  })
})

describe('assertNoExistingCheckIn', () => {
  it('passes_when_no_existing_record', () => {
    expect(() => assertNoExistingCheckIn(null)).not.toThrow()
  })

  it('throws_ConflictError_when_record_exists', () => {
    expect(() => assertNoExistingCheckIn(makeRecord())).toThrow(ConflictError)
  })
})

describe('toDateString', () => {
  it('returns_YYYY-MM-DD_portion', () => {
    expect(toDateString(new Date('2026-06-14T09:30:00Z'))).toBe('2026-06-14')
  })
})
