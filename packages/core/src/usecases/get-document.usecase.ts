import type { GetDocumentRepository, EmployeeDocumentData } from '../contracts/documents'
import { NotFoundError } from '../domain/errors'

/**
 * Retrieves a single document by its identifier.
 */
export class GetDocumentUseCase {
  /**
   * @param documentRepo - capability to load a document by id
   */
  constructor(private readonly documentRepo: GetDocumentRepository) {}

  /**
   * Loads a document, failing if it does not exist.
   *
   * @param id - identifier of the document to retrieve
   * @returns the requested document
   * @throws {NotFoundError} when no document exists with the given id
   */
  async execute(id: string): Promise<EmployeeDocumentData> {
    const doc = await this.documentRepo.findById(id)
    if (!doc) throw new NotFoundError(`Document ${id} not found`)
    return doc
  }
}
