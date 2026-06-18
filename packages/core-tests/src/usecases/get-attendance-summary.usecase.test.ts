import { describe, it, expect, mock } from 'bun:test'
import { GetAttendanceSummaryUseCase } from '@hrms/core/usecases/get-attendance-summary.usecase'
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

describe('GetAttendanceSummaryUseCase', () => {
  // getSummary: delegates_to_repository
  it('delegates_to_repository', async () => {
    const attendanceRepo = makeAttendanceRepo()
    const uc = new GetAttendanceSummaryUseCase(attendanceRepo)
    const summary = await uc.execute('emp-1', '2026-06-01', '2026-06-30')
    expect(summary.totalHours).toBe(8)
  })
})
