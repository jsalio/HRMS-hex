import type { SignDocumentRepository, EmployeeDocumentData } from '../contracts/documents'
import { EmployeeDocument } from '../domain/employee-document'
import { NotFoundError } from '../domain/errors'

/**
 * Records a digital signature on a pending document.
 */
export class SignDocumentUseCase {
  /**
   * @param documentRepo - capabilities to load and sign the document
   */
  constructor(private readonly documentRepo: SignDocumentRepository) {}

  /**
   * Signs a document after verifying it exists and may be signed.
   *
   * @param id - identifier of the document to sign
   * @param fileHash - SHA-256 hash of the signed file
   * @param signedByUserId - identifier of the signing user
   * @returns the signed document
   * @throws {NotFoundError} when no document exists with the given id
   * @throws {ValidationError} when the document cannot be signed in its current state
   */
  async execute(
    id: string,
    fileHash: string,
    signedByUserId: string,
  ): Promise<EmployeeDocumentData> {
    const raw = await this.documentRepo.findById(id)
    if (!raw) throw new NotFoundError(`Document ${id} not found`)

    new EmployeeDocument(raw).assertCanBeSigned()

    return this.documentRepo.sign(id, {
      fileHash,
      signedBy: signedByUserId,
      signedAt: new Date(),
    })
  }
}
