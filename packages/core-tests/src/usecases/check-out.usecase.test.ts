import { describe, it, expect, mock } from 'bun:test'
import { CheckOutUseCase } from '@hrms/core/usecases/check-out.usecase'
import { ValidationError } from '@hrms/core/domain/errors'
import type { IAttendanceRepository, AttendanceRecordData } from '@hrms/core/contracts/attendance'

const now = new Date('2026-06-14T09:00:00Z')
const later = new Date('2026-06-14T17:00:00Z')

const mockRecord: AttendanceRecordData = {
  id: 'rec-1', employeeId: 'emp-1', date: '2026-06-14',
  checkIn: now, checkOut: null, hoursWorked: null,
  status: 'PRESENT', notes: null, createdAt: now, updatedAt: now,
}

function makeAttendanceRepo(): IAttendanceRepository {
  return {
    findAll:               mock(async () => ({ data: [mockRecord], total: 1 })),
    findById:              mock(async () => mockRecord),
    findByEmployeeAndDate: mock(async () => null),
    createCheckIn:         mock(async () => mockRecord),
    updateCheckOut:        mock(async () => ({ ...mockRecord, checkOut: later, hoursWorked: 8 })),
    update:                mock(async () => mockRecord),
    getSummary:            mock(async () => ({ totalDays: 1, presentDays: 1, absentDays: 0, lateDays: 0, totalHours: 8 })),
  }
}

describe('CheckOutUseCase', () => {
  // checkOut: updates_checkout_when_checkin_exists_and_timestamp_is_valid
  it('updates_checkout_when_checkin_exists_and_timestamp_is_valid', async () => {
    const attendanceRepo = makeAttendanceRepo()
    ;(attendanceRepo.findByEmployeeAndDate as any).mockImplementation(async () => mockRecord)
    const uc = new CheckOutUseCase(attendanceRepo)
    const result = await uc.execute('emp-1', later)
    expect(result.checkOut).toEqual(later)
    expect(attendanceRepo.updateCheckOut).toHaveBeenCalled()
  })

  // checkOut: throws_ValidationError_when_no_checkin_today
  it('throws_ValidationError_when_no_checkin_today', async () => {
    const attendanceRepo = makeAttendanceRepo()
    const uc = new CheckOutUseCase(attendanceRepo)
    await expect(uc.execute('emp-1', later)).rejects.toThrow(ValidationError)
  })

  // checkOut: throws_ValidationError_when_checkout_before_checkin
  it('throws_ValidationError_when_checkout_before_checkin', async () => {
    const attendanceRepo = makeAttendanceRepo()
    ;(attendanceRepo.findByEmployeeAndDate as any).mockImplementation(async () => mockRecord)
    const uc = new CheckOutUseCase(attendanceRepo)
    const earlier = new Date(now.getTime() - 1000)
    await expect(uc.execute('emp-1', earlier)).rejects.toThrow(ValidationError)
  })
})
