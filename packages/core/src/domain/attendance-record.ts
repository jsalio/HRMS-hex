import type { AttendanceRecordData } from '../contracts/attendance'
import { ValidationError, ConflictError } from './errors'

/**
 * Domain entity representing a single day's attendance record for an employee.
 * Enforces the invariants that govern when a valid check-out may be registered.
 */
export class AttendanceRecord {
  /**
   * @param props - check-in, check-out and worked-hours data backing the record
   */
  constructor(private readonly props: AttendanceRecordData) {}

  /**
   * @returns the attendance record identifier
   */
  get id()          { return this.props.id }
  /**
   * @returns the check-in timestamp, or null when no check-in has been registered
   */
  get checkIn()     { return this.props.checkIn }
  /**
   * @returns the check-out timestamp, or null when no check-out has been registered
   */
  get checkOut()    { return this.props.checkOut }
  /**
   * @returns the number of hours worked, or null when the day is not yet closed
   */
  get hoursWorked() { return this.props.hoursWorked }

  /**
   * Guards registration of a check-out for this record.
   *
   * @param timestamp - the proposed check-out time
   * @throws {ValidationError} when there is no prior check-in, or when the timestamp is not strictly after the check-in time
   */
  assertCanCheckOut(timestamp: Date): void {
    if (!this.props.checkIn) {
      throw new ValidationError('Cannot check out: no check-in record found for today')
    }
    if (timestamp <= this.props.checkIn) {
      throw new ValidationError('Check-out time must be after check-in time')
    }
  }
}

/**
 * Guards that an employee does not already have an attendance record for the day.
 *
 * @param existing - the existing attendance record for the day, or null when none exists
 * @throws {ConflictError} when a check-in record already exists for the day
 */
export function assertNoExistingCheckIn(existing: AttendanceRecordData | null): void {
  if (existing) {
    throw new ConflictError('Employee already has a check-in record for today')
  }
}

/**
 * Converts a timestamp to its calendar-day key.
 *
 * @param ts - the timestamp to convert
 * @returns the date portion of the timestamp as an ISO `YYYY-MM-DD` string
 */
export function toDateString(ts: Date): string {
  return ts.toISOString().slice(0, 10)
}
