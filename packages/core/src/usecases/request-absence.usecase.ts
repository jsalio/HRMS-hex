import type {
  RequestAbsenceRepository,
  RequestAbsenceEmployeeRepository,
  CreateAbsenceRequestInput,
  AbsenceRequestData,
} from '../contracts/absences'
import { AbsenceBalance, calculateWorkingDays } from '../domain/absence-balance'
import { NotFoundError, ValidationError } from '../domain/errors'

/**
 * Creates a pending absence request, validating the employee, type, dates,
 * overlaps and available balance, then reserving the requested days.
 */
export class RequestAbsenceUseCase {
  /**
   * @param absenceRepo - capabilities to validate, persist the request and reserve days
   * @param employeeRepo - capability to load the employee being requested for
   */
  constructor(
    private readonly absenceRepo: RequestAbsenceRepository,
    private readonly employeeRepo: RequestAbsenceEmployeeRepository,
  ) {}

  /**
   * Requests an absence after validating all business rules and reserving days.
   *
   * @param input - request details plus the requester identifier; working days are computed
   * @returns the created pending absence request
   * @throws {NotFoundError} when the employee or absence type does not exist
   * @throws {ValidationError} when the employee is inactive, the date range has no working days, it overlaps an existing request, or the balance is insufficient
   */
  async execute(input: Omit<CreateAbsenceRequestInput, 'workingDays'> & { requesterId: string }): Promise<AbsenceRequestData> {
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
}
