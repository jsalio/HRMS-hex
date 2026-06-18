import type { ArchiveDocumentRepository, EmployeeDocumentData } from '../contracts/documents'
import { EmployeeDocument } from '../domain/employee-document'
import { NotFoundError } from '../domain/errors'

/**
 * Archives a document that is in an archivable state.
 */
export class ArchiveDocumentUseCase {
  /**
   * @param documentRepo - capabilities to load and archive the document
   */
  constructor(private readonly documentRepo: ArchiveDocumentRepository) {}

  /**
   * Archives a document after verifying it exists and may be archived.
   *
   * @param id - identifier of the document to archive
   * @returns the archived document
   * @throws {NotFoundError} when no document exists with the given id
   * @throws {ValidationError} when the document cannot be archived in its current state
   */
  async execute(id: string): Promise<EmployeeDocumentData> {
    const raw = await this.documentRepo.findById(id)
    if (!raw) throw new NotFoundError(`Document ${id} not found`)

    new EmployeeDocument(raw).assertCanBeArchived()

    return this.documentRepo.archive(id, new Date())
  }
}
