import type {
  CreateDocumentRepository,
  EmployeeDocumentData,
  DocumentType,
} from '../contracts/documents'
import type { IEmployeeRepository } from '../contracts/employees'
import { NotFoundError, ValidationError } from '../domain/errors'

/** Input required to create a document for an employee. */
export interface CreateDocumentInput {
  employeeId: string
  name: string
  type: DocumentType
  fileUrl: string
  templateId?: string | null
  expiresAt?: string | null
}

/**
 * Creates a new document for an active employee.
 */
export class CreateDocumentUseCase {
  /**
   * @param documentRepo - capability to persist the new document
   * @param employeeRepo - repository used to validate the owning employee
   */
  constructor(
    private readonly documentRepo: CreateDocumentRepository,
    private readonly employeeRepo: IEmployeeRepository,
  ) {}

  /**
   * Creates a document after confirming the employee exists and is active.
   *
   * @param input - employee, document metadata and optional expiry
   * @returns the persisted document
   * @throws {NotFoundError} when the employee does not exist
   * @throws {ValidationError} when the employee is inactive
   */
  async execute(input: CreateDocumentInput): Promise<EmployeeDocumentData> {
    const employee = await this.employeeRepo.findById(input.employeeId)
    if (!employee) throw new NotFoundError(`Employee ${input.employeeId} not found`)
    if (employee.status === 'INACTIVE') {
      throw new ValidationError('Cannot add documents to an inactive employee')
    }

    return this.documentRepo.create({
      employeeId: input.employeeId,
      templateId: input.templateId ?? null,
      name:       input.name,
      type:       input.type,
      fileUrl:    input.fileUrl,
      expiresAt:  input.expiresAt ? new Date(input.expiresAt) : null,
    })
  }
}
