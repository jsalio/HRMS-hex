import type { AttendanceRecordData } from '../contracts/attendance'
import { ValidationError, ConflictError } from './errors'

export class AttendanceRecord {
  constructor(private readonly props: AttendanceRecordData) {}

  get id()          { return this.props.id }
  get checkIn()     { return this.props.checkIn }
  get checkOut()    { return this.props.checkOut }
  get hoursWorked() { return this.props.hoursWorked }

  assertCanCheckOut(timestamp: Date): void {
    if (!this.props.checkIn) {
      throw new ValidationError('Cannot check out: no check-in record found for today')
    }
    if (timestamp <= this.props.checkIn) {
      throw new ValidationError('Check-out time must be after check-in time')
    }
  }
}

export function assertNoExistingCheckIn(existing: AttendanceRecordData | null): void {
  if (existing) {
    throw new ConflictError('Employee already has a check-in record for today')
  }
}

export function toDateString(ts: Date): string {
  return ts.toISOString().slice(0, 10)
}
