import type { CancelAbsenceRepository, AbsenceRequestData } from '../contracts/absences'
import { assertCanCancel } from '../domain/absence-balance'
import { NotFoundError } from '../domain/errors'

/**
 * Cancels a pending absence request owned by the requesting employee,
 * releasing its reserved days.
 */
export class CancelAbsenceUseCase {
  /**
   * @param absenceRepo - capabilities to load the request, release days and update status
   */
  constructor(private readonly absenceRepo: CancelAbsenceRepository) {}

  /**
   * Cancels a request after confirming it is pending and owned by the requester.
   *
   * @param requestId - identifier of the request to cancel
   * @param requestingEmployeeId - identifier of the employee attempting the cancellation
   * @returns the updated, cancelled request
   * @throws {NotFoundError} when no request exists with the given id
   * @throws {ValidationError} when the request is not pending or the employee is not its owner
   */
  async execute(requestId: string, requestingEmployeeId: string): Promise<AbsenceRequestData> {
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
