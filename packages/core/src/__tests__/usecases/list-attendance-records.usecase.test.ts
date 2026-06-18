import { describe, it, expect, mock } from 'bun:test'
import { ListAttendanceRecordsUseCase } from '../../usecases/list-attendance-records.usecase'
import type { IAttendanceRepository, AttendanceRecordData } from '../../contracts/attendance'

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

describe('ListAttendanceRecordsUseCase', () => {
  // listRecords: delegates_to_repository
  it('delegates_to_repository', async () => {
    const attendanceRepo = makeAttendanceRepo()
    const uc = new ListAttendanceRecordsUseCase(attendanceRepo)
    const result = await uc.execute({})
    expect(result.total).toBe(1)
    expect(attendanceRepo.findAll).toHaveBeenCalled()
  })
})
