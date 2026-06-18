import type { ListExpiringDocumentsRepository, ExpiringDocumentData } from '../contracts/documents'

/**
 * Lists documents that are due to expire within a given window.
 */
export class ListExpiringDocumentsUseCase {
  /**
   * @param documentRepo - capability to read documents nearing expiry
   */
  constructor(private readonly documentRepo: ListExpiringDocumentsRepository) {}

  /**
   * Retrieves documents expiring within the given number of days.
   *
   * @param days - size of the look-ahead window in days
   * @returns the expiring documents, each including owning employee data
   */
  async execute(days: number): Promise<ExpiringDocumentData[]> {
    return this.documentRepo.findExpiring(days)
  }
}
