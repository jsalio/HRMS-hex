export type DocumentStatus = 'PENDING' | 'SIGNED' | 'ARCHIVED'
export type DocumentType = 'contract' | 'nda' | 'policy' | 'certificate' | 'other'

export interface EmployeeDocumentData {
  id: string
  employeeId: string
  templateId: string | null
  name: string
  type: DocumentType
  status: DocumentStatus
  fileUrl: string
  fileHash: string | null
  signedAt: Date | null
  signedBy: string | null
  archivedAt: Date | null
  expiresAt: Date | null
  renewalNotifiedAt: Date | null
  renewedFromId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ExpiringDocumentData extends EmployeeDocumentData {
  employee: { id: string; fullName: string; corporateEmail: string }
}

export interface IDocumentRepository {
  findByEmployee(
    employeeId: string,
    filters?: { status?: DocumentStatus; type?: DocumentType },
  ): Promise<EmployeeDocumentData[]>
  findById(id: string): Promise<EmployeeDocumentData | null>
  create(data: {
    employeeId: string
    templateId?: string | null
    name: string
    type: DocumentType
    fileUrl: string
    expiresAt?: Date | null
    renewedFromId?: string | null
  }): Promise<EmployeeDocumentData>
  sign(id: string, data: { fileHash: string; signedBy: string; signedAt: Date }): Promise<EmployeeDocumentData>
  archive(id: string, archivedAt: Date): Promise<EmployeeDocumentData>
  findExpiring(daysFromNow: number): Promise<ExpiringDocumentData[]>
}
