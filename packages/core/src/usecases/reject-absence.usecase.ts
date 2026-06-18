import type { RejectAbsenceRepository, AbsenceRequestData } from '../contracts/absences'
import { assertCanReject } from '../domain/absence-balance'
import { NotFoundError } from '../domain/errors'

/**
 * Rejects a pending absence request, releasing its reserved days.
 */
export class RejectAbsenceUseCase {
  /**
   * @param absenceRepo - capabilities to load the request, release days and update status
   */
  constructor(private readonly absenceRepo: RejectAbsenceRepository) {}

  /**
   * Rejects a request after confirming it is pending and releasing its days.
   *
   * @param requestId - identifier of the request to reject
   * @param reviewerId - identifier of the reviewer rejecting the request
   * @param notes - mandatory review notes explaining the rejection
   * @returns the updated, rejected request
   * @throws {NotFoundError} when no request exists with the given id
   * @throws {ValidationError} when the request is not in a pending state
   */
  async execute(requestId: string, reviewerId: string, notes: string): Promise<AbsenceRequestData> {
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
}
