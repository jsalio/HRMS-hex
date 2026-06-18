import type { RenewDocumentRepository, EmployeeDocumentData } from '../contracts/documents'
import { NotFoundError } from '../domain/errors'

/** Input required to renew an existing document. */
export interface RenewDocumentInput {
  fileUrl: string
  expiresAt?: string | null
}

/**
 * Renews a document by creating a new pending copy linked to the original.
 */
export class RenewDocumentUseCase {
  /**
   * @param documentRepo - capabilities to load the original and persist the renewal
   */
  constructor(private readonly documentRepo: RenewDocumentRepository) {}

  /**
   * Creates a renewal document that references the original, copying its metadata.
   *
   * @param id - identifier of the document being renewed
   * @param input - new file location and optional expiry for the renewal
   * @returns the newly created renewal document
   * @throws {NotFoundError} when no document exists with the given id
   */
  async execute(id: string, input: RenewDocumentInput): Promise<EmployeeDocumentData> {
    const original = await this.documentRepo.findById(id)
    if (!original) throw new NotFoundError(`Document ${id} not found`)

    return this.documentRepo.create({
      employeeId:   original.employeeId,
      templateId:   original.templateId,
      name:         original.name,
      type:         original.type,
      fileUrl:      input.fileUrl,
      expiresAt:    input.expiresAt ? new Date(input.expiresAt) : null,
      renewedFromId: id,
    })
  }
}
