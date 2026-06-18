import type { ApproveAbsenceRepository, AbsenceRequestData } from '../contracts/absences'
import { assertCanApprove } from '../domain/absence-balance'
import { NotFoundError } from '../domain/errors'

/**
 * Approves a pending absence request, converting reserved days into used days.
 */
export class ApproveAbsenceUseCase {
  /**
   * @param absenceRepo - capabilities to load the request, adjust the balance and update status
   */
  constructor(private readonly absenceRepo: ApproveAbsenceRepository) {}

  /**
   * Approves a request after confirming it is pending and updating its balance.
   *
   * @param requestId - identifier of the request to approve
   * @param reviewerId - identifier of the reviewer approving the request
   * @param notes - optional review notes
   * @returns the updated, approved request
   * @throws {NotFoundError} when no request exists with the given id
   * @throws {ValidationError} when the request is not in a pending state
   */
  async execute(requestId: string, reviewerId: string, notes?: string): Promise<AbsenceRequestData> {
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
}
