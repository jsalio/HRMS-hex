import type {
  ListDocumentsRepository,
  EmployeeDocumentData,
  DocumentStatus,
  DocumentType,
} from '../contracts/documents'

/**
 * Lists the documents owned by a single employee, optionally filtered.
 */
export class ListDocumentsUseCase {
  /**
   * @param documentRepo - capability to read an employee's documents
   */
  constructor(private readonly documentRepo: ListDocumentsRepository) {}

  /**
   * Retrieves an employee's documents, applying optional status/type filters.
   *
   * @param employeeId - identifier of the owning employee
   * @param filters - optional status and/or type to narrow the result
   * @returns the matching documents in repository order
   */
  async execute(
    employeeId: string,
    filters?: { status?: DocumentStatus; type?: DocumentType },
  ): Promise<EmployeeDocumentData[]> {
    return this.documentRepo.findByEmployee(employeeId, filters)
  }
}
