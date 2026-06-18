import type { CheckOutRepository, AttendanceRecordData } from '../contracts/attendance'
import { AttendanceRecord, toDateString } from '../domain/attendance-record'
import { ValidationError } from '../domain/errors'

/**
 * Registers an employee's check-out against an existing check-in record.
 */
export class CheckOutUseCase {
  /**
   * @param attendanceRepo - capabilities to load the day's record and persist the check-out
   */
  constructor(private readonly attendanceRepo: CheckOutRepository) {}

  /**
   * Records a check-out for an employee that has a valid check-in for the day.
   *
   * @param employeeId - identifier of the employee checking out
   * @param timestamp - moment of the check-out
   * @returns the updated attendance record
   * @throws {ValidationError} when no check-in record exists for the day or the check-out time is invalid
   */
  async execute(employeeId: string, timestamp: Date): Promise<AttendanceRecordData> {
    const date = toDateString(timestamp)
    const record = await this.attendanceRepo.findByEmployeeAndDate(employeeId, date)
    if (!record) throw new ValidationError('No check-in record found for today')

    new AttendanceRecord(record).assertCanCheckOut(timestamp)
    return this.attendanceRepo.updateCheckOut(record.id, timestamp)
  }
}
