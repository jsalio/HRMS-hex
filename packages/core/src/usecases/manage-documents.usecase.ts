import type {
  IDocumentRepository,
  EmployeeDocumentData,
  ExpiringDocumentData,
  DocumentStatus,
  DocumentType,
} from '../contracts/documents'
import type { IEmployeeRepository } from '../contracts/employees'
import { EmployeeDocument } from '../domain/employee-document'
import { NotFoundError, ValidationError } from '../domain/errors'

interface CreateDocumentInput {
  employeeId: string
  name: string
  type: DocumentType
  fileUrl: string
  templateId?: string | null
  expiresAt?: string | null
}

interface RenewDocumentInput {
  fileUrl: string
  expiresAt?: string | null
}

export class ManageDocumentsUseCase {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly employeeRepo: IEmployeeRepository,
  ) {}

  async listDocuments(
    employeeId: string,
    filters?: { status?: DocumentStatus; type?: DocumentType },
  ): Promise<EmployeeDocumentData[]> {
    return this.documentRepo.findByEmployee(employeeId, filters)
  }

  async getDocument(id: string): Promise<EmployeeDocumentData> {
    const doc = await this.documentRepo.findById(id)
    if (!doc) throw new NotFoundError(`Document ${id} not found`)
    return doc
  }

  async createDocument(input: CreateDocumentInput): Promise<EmployeeDocumentData> {
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

  async signDocument(
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

  async archiveDocument(id: string): Promise<EmployeeDocumentData> {
    const raw = await this.documentRepo.findById(id)
    if (!raw) throw new NotFoundError(`Document ${id} not found`)

    new EmployeeDocument(raw).assertCanBeArchived()

    return this.documentRepo.archive(id, new Date())
  }

  async renewDocument(id: string, input: RenewDocumentInput): Promise<EmployeeDocumentData> {
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

  async listExpiringDocuments(days: number): Promise<ExpiringDocumentData[]> {
    return this.documentRepo.findExpiring(days)
  }
}
