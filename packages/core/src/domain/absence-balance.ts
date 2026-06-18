import type { AbsenceBalanceData, AbsenceRequestData } from '../contracts/absences'
import { ValidationError } from './errors'

/**
 * Domain entity representing an employee's absence balance for a leave type.
 * Enforces the invariant that a request cannot exceed the available balance.
 */
export class AbsenceBalance {
  /**
   * @param props - allocated, used and pending day counters backing the balance
   */
  constructor(private readonly props: AbsenceBalanceData) {}

  /**
   * @returns the balance identifier
   */
  get id()            { return this.props.id }
  /**
   * @returns the total number of days allocated for the period
   */
  get allocatedDays() { return this.props.allocatedDays }
  /**
   * @returns the number of days already consumed by approved requests
   */
  get usedDays()      { return this.props.usedDays }
  /**
   * @returns the number of days reserved by requests awaiting approval
   */
  get pendingDays()   { return this.props.pendingDays }

  /**
   * @returns the number of days still available, computed as allocated minus used minus pending
   */
  get availableDays(): number {
    return this.props.allocatedDays - this.props.usedDays - this.props.pendingDays
  }

  /**
   * Guards that the balance can absorb a new request.
   *
   * @param requestedDays - the number of days the request would consume
   * @throws {ValidationError} when the requested days exceed the available balance
   */
  assertHasSufficientBalance(requestedDays: number): void {
    if (this.availableDays < requestedDays) {
      throw new ValidationError(
        `Insufficient balance: ${this.availableDays} days available, ${requestedDays} requested`
      )
    }
  }
}

/**
 * Guards approval of an absence request.
 *
 * @param request - the absence request being approved
 * @throws {ValidationError} when the request is not in the PENDING status
 */
export function assertCanApprove(request: AbsenceRequestData): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot approve: request status is ${request.status}`)
  }
}

/**
 * Guards rejection of an absence request.
 *
 * @param request - the absence request being rejected
 * @throws {ValidationError} when the request is not in the PENDING status
 */
export function assertCanReject(request: AbsenceRequestData): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot reject: request status is ${request.status}`)
  }
}

/**
 * Guards cancellation of an absence request.
 *
 * @param request - the absence request being cancelled
 * @param requestingUserId - the identifier of the user attempting the cancellation
 * @throws {ValidationError} when the request is not PENDING, or when the requester is not the request owner
 */
export function assertCanCancel(request: AbsenceRequestData, requestingUserId: string): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot cancel: request status is ${request.status}`)
  }
  if (request.employeeId !== requestingUserId) {
    throw new ValidationError('Cannot cancel: only the request owner can cancel it')
  }
}

/**
 * Counts the working days (Monday to Friday) within an inclusive date range.
 *
 * @param startDate - ISO date string marking the first day of the range
 * @param endDate - ISO date string marking the last day of the range, inclusive
 * @returns the number of weekdays between the two dates, excluding weekends
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end   = new Date(endDate)
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) days++
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
