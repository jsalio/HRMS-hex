import type { IAttendanceRepository, AttendanceListQuery, AttendanceRecordData, AttendanceStatus } from '../contracts/attendance'
import type { IEmployeeRepository } from '../contracts/employees'
import { AttendanceRecord, assertNoExistingCheckIn, toDateString } from '../domain/attendance-record'
import { NotFoundError, ValidationError } from '../domain/errors'

export class ManageAttendanceUseCase {
  constructor(
    private readonly attendanceRepo: IAttendanceRepository,
    private readonly employeeRepo: IEmployeeRepository,
  ) {}

  listRecords(query: AttendanceListQuery) {
    return this.attendanceRepo.findAll(query)
  }

  getSummary(employeeId: string, from: string, to: string) {
    return this.attendanceRepo.getSummary(employeeId, from, to)
  }

  async checkIn(employeeId: string, timestamp: Date) {
    const employee = await this.employeeRepo.findById(employeeId)
    if (!employee) throw new NotFoundError(`Employee ${employeeId} not found`)
    if (employee.status === 'INACTIVE') {
      throw new ValidationError('Cannot register attendance for an inactive employee')
    }

    const date = toDateString(timestamp)
    const existing = await this.attendanceRepo.findByEmployeeAndDate(employeeId, date)
    assertNoExistingCheckIn(existing)

    return this.attendanceRepo.createCheckIn(employeeId, timestamp)
  }

  async checkOut(employeeId: string, timestamp: Date) {
    const date = toDateString(timestamp)
    const record = await this.attendanceRepo.findByEmployeeAndDate(employeeId, date)
    if (!record) throw new ValidationError('No check-in record found for today')

    new AttendanceRecord(record).assertCanCheckOut(timestamp)
    return this.attendanceRepo.updateCheckOut(record.id, timestamp)
  }

  async editRecord(id: string, data: Partial<Pick<AttendanceRecordData, 'checkIn' | 'checkOut' | 'status' | 'notes'>>) {
    const record = await this.attendanceRepo.findById(id)
    if (!record) throw new NotFoundError(`Attendance record ${id} not found`)

    if (data.checkIn && data.checkOut && data.checkOut <= data.checkIn) {
      throw new ValidationError('check_out must be after check_in')
    }
    if (data.checkOut && !data.checkIn && record.checkIn && data.checkOut <= record.checkIn) {
      throw new ValidationError('check_out must be after check_in')
    }

    return this.attendanceRepo.update(id, data)
  }
}
