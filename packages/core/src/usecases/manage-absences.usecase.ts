import type { IAbsenceRepository, AbsenceRequestQuery, CreateAbsenceRequestInput } from '../contracts/absences'
import type { IEmployeeRepository } from '../contracts/employees'
import { AbsenceBalance, assertCanApprove, assertCanReject, assertCanCancel, calculateWorkingDays } from '../domain/absence-balance'
import { NotFoundError, ValidationError } from '../domain/errors'

export class ManageAbsencesUseCase {
  constructor(
    private readonly absenceRepo: IAbsenceRepository,
    private readonly employeeRepo: IEmployeeRepository,
  ) {}

  listAbsenceTypes() {
    return this.absenceRepo.findAbsenceTypes()
  }

  listBalances(employeeId: string, year: number) {
    return this.absenceRepo.findBalancesByEmployee(employeeId, year)
  }

  listRequests(query: AbsenceRequestQuery) {
    return this.absenceRepo.findRequests(query)
  }

  async requestAbsence(input: Omit<CreateAbsenceRequestInput, 'workingDays'> & { requesterId: string }) {
    const employee = await this.employeeRepo.findById(input.employeeId)
    if (!employee) throw new NotFoundError(`Employee ${input.employeeId} not found`)
    if (employee.status === 'INACTIVE') {
      throw new ValidationError('Cannot request absence for an inactive employee')
    }

    const absenceType = await this.absenceRepo.findAbsenceTypeById(input.absenceTypeId)
    if (!absenceType) throw new NotFoundError(`Absence type ${input.absenceTypeId} not found`)

    const workingDays = calculateWorkingDays(input.startDate, input.endDate)
    if (workingDays <= 0) {
      throw new ValidationError('The selected date range has no working days')
    }

    const overlapping = await this.absenceRepo.findOverlapping(
      input.employeeId, input.absenceTypeId, input.startDate, input.endDate
    )
    if (overlapping.length > 0) {
      throw new ValidationError('Absence request overlaps with an existing request for the same type')
    }

    const year = new Date(input.startDate).getFullYear()
    const balance = await this.absenceRepo.findOrCreateBalance(
      input.employeeId, input.absenceTypeId, year, absenceType.annualAllowanceDays
    )

    new AbsenceBalance(balance).assertHasSufficientBalance(workingDays)

    const request = await this.absenceRepo.createRequest({
      employeeId: input.employeeId,
      absenceTypeId: input.absenceTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      workingDays,
      reason: input.reason,
    })

    await this.absenceRepo.reservePendingDays(balance.id, workingDays)
    return request
  }

  async approveAbsence(requestId: string, reviewerId: string, notes?: string) {
    const request = await this.absenceRepo.findRequestById(requestId)
    if (!request) throw new NotFoundError(`Absence request ${requestId} not found`)
    assertCanApprove(request)

    const year = new Date(request.startDate).getFullYear()
    const balance = await this.absenceRepo.findOrCreateBalance(
      request.employeeId, request.absenceTypeId, year, 0
    )

    await this.absenceRepo.approveBalance(balance.id, request.workingDays)
    return this.absenceRepo.updateRequestStatus(requestId, 'APPROVED', reviewerId, notes ?? null)
  }

  async rejectAbsence(requestId: string, reviewerId: string, notes: string) {
    const request = await this.absenceRepo.findRequestById(requestId)
    if (!request) throw new NotFoundError(`Absence request ${requestId} not found`)
    assertCanReject(request)

    const year = new Date(request.startDate).getFullYear()
    const balance = await this.absenceRepo.findOrCreateBalance(
      request.employeeId, request.absenceTypeId, year, 0
    )

    await this.absenceRepo.releasePendingDays(balance.id, request.workingDays)
    return this.absenceRepo.updateRequestStatus(requestId, 'REJECTED', reviewerId, notes)
  }

  async cancelAbsence(requestId: string, requestingEmployeeId: string) {
    const request = await this.absenceRepo.findRequestById(requestId)
    if (!request) throw new NotFoundError(`Absence request ${requestId} not found`)
    assertCanCancel(request, requestingEmployeeId)

    const year = new Date(request.startDate).getFullYear()
    const balance = await this.absenceRepo.findOrCreateBalance(
      request.employeeId, request.absenceTypeId, year, 0
    )

    await this.absenceRepo.releasePendingDays(balance.id, request.workingDays)
    return this.absenceRepo.updateRequestStatus(requestId, 'CANCELLED', null, null)
  }
}
