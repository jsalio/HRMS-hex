import type { AbsenceBalanceData, AbsenceRequestData } from '../contracts/absences'
import { ValidationError } from './errors'

export class AbsenceBalance {
  constructor(private readonly props: AbsenceBalanceData) {}

  get id()            { return this.props.id }
  get allocatedDays() { return this.props.allocatedDays }
  get usedDays()      { return this.props.usedDays }
  get pendingDays()   { return this.props.pendingDays }

  get availableDays(): number {
    return this.props.allocatedDays - this.props.usedDays - this.props.pendingDays
  }

  assertHasSufficientBalance(requestedDays: number): void {
    if (this.availableDays < requestedDays) {
      throw new ValidationError(
        `Insufficient balance: ${this.availableDays} days available, ${requestedDays} requested`
      )
    }
  }
}

export function assertCanApprove(request: AbsenceRequestData): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot approve: request status is ${request.status}`)
  }
}

export function assertCanReject(request: AbsenceRequestData): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot reject: request status is ${request.status}`)
  }
}

export function assertCanCancel(request: AbsenceRequestData, requestingUserId: string): void {
  if (request.status !== 'PENDING') {
    throw new ValidationError(`Cannot cancel: request status is ${request.status}`)
  }
  if (request.employeeId !== requestingUserId) {
    throw new ValidationError('Cannot cancel: only the request owner can cancel it')
  }
}

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
