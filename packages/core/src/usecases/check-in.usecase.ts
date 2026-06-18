import type { CheckInRepository, AttendanceRecordData } from '../contracts/attendance'
import type { IEmployeeRepository } from '../contracts/employees'
import { assertNoExistingCheckIn, toDateString } from '../domain/attendance-record'
import { NotFoundError, ValidationError } from '../domain/errors'

/**
 * Registers an employee's check-in, enforcing employee state and single-entry rules.
 */
export class CheckInUseCase {
  /**
   * @param attendanceRepo - capabilities to look up the day's record and persist the check-in
   * @param employeeRepo - capability to load the employee being checked in
   */
  constructor(
    private readonly attendanceRepo: CheckInRepository,
    private readonly employeeRepo: IEmployeeRepository,
  ) {}

  /**
   * Records a check-in for an active employee that has not already checked in today.
   *
   * @param employeeId - identifier of the employee checking in
   * @param timestamp - moment of the check-in
   * @returns the persisted attendance record
   * @throws {NotFoundError} when no employee exists with the given id
   * @throws {ValidationError} when the employee is inactive
   * @throws {ConflictError} when the employee has already checked in for the day
   */
  async execute(employeeId: string, timestamp: Date): Promise<AttendanceRecordData> {
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
}
