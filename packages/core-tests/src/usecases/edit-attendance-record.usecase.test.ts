import { describe, it, expect, mock } from 'bun:test'
import { EditAttendanceRecordUseCase } from '@hrms/core/usecases/edit-attendance-record.usecase'
import { NotFoundError, ValidationError } from '@hrms/core/domain/errors'
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

describe('EditAttendanceRecordUseCase', () => {
  // editRecord: updates_record_when_found
  it('updates_record_when_found', async () => {
    const attendanceRepo = makeAttendanceRepo()
    const uc = new EditAttendanceRecordUseCase(attendanceRepo)
    const result = await uc.execute('rec-1', { notes: 'corrected' })
    expect(attendanceRepo.update).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  // editRecord: throws_NotFoundError_when_record_not_found
  it('throws_NotFoundError_when_record_not_found', async () => {
    const attendanceRepo = makeAttendanceRepo()
    ;(attendanceRepo.findById as any).mockImplementation(async () => null)
    const uc = new EditAttendanceRecordUseCase(attendanceRepo)
    await expect(uc.execute('ghost', { notes: 'x' })).rejects.toThrow(NotFoundError)
  })

  // editRecord: throws_ValidationError_when_checkout_before_checkin_in_edit
  it('throws_ValidationError_when_checkout_before_checkin_in_edit', async () => {
    const attendanceRepo = makeAttendanceRepo()
    const uc = new EditAttendanceRecordUseCase(attendanceRepo)
    const earlier = new Date(now.getTime() - 1000)
    await expect(uc.execute('rec-1', { checkIn: later, checkOut: earlier })).rejects.toThrow(ValidationError)
  })
})
