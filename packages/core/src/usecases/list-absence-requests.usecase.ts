import type { ListAbsenceRequestsRepository, AbsenceRequestData, AbsenceRequestQuery } from '../contracts/absences'

/**
 * Retrieves absence requests matching a query, with pagination metadata.
 */
export class ListAbsenceRequestsUseCase {
  /**
   * @param absenceRepo - capability to query absence requests
   */
  constructor(private readonly absenceRepo: ListAbsenceRequestsRepository) {}

  /**
   * Lists absence requests matching the given filters.
   *
   * @param query - filter and pagination criteria
   * @returns the matching requests and the total count
   */
  execute(query: AbsenceRequestQuery): Promise<{ data: AbsenceRequestData[]; total: number }> {
    return this.absenceRepo.findRequests(query)
  }
}
