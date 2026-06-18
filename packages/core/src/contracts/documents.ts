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

/** Shape accepted when persisting a new document (or a renewal). */
export interface CreateDocumentData {
  /** Owner employee identifier */
  employeeId: string
  /** Template the document derives from, if any */
  templateId?: string | null
  /** Human-readable document name */
  name: string
  /** Document classification */
  type: DocumentType
  /** Location of the stored file */
  fileUrl: string
  /** Expiry instant, if the document expires */
  expiresAt?: Date | null
  /** Identifier of the document this one renews, if any */
  renewedFromId?: string | null
}

/** Signature metadata applied when a document is signed. */
export interface SignDocumentData {
  /** SHA-256 hash of the signed file */
  fileHash: string
  /** User identifier that performed the signature */
  signedBy: string
  /** Instant the signature occurred */
  signedAt: Date
}

// ── Atomic capabilities — each defined once, one responsibility ──────────────

/** Capability: read every document belonging to an employee. */
export interface IFindDocumentsByEmployee {
  /** @returns the employee's documents matching the optional filters */
  findByEmployee(
    employeeId: string,
    filters?: { status?: DocumentStatus; type?: DocumentType },
  ): Promise<EmployeeDocumentData[]>
}

/** Capability: read a single document by identifier. */
export interface IFindDocumentById {
  /** @returns the document with the given id, or null if none exists */
  findById(id: string): Promise<EmployeeDocumentData | null>
}

/** Capability: persist a new document. */
export interface ICreateDocument {
  /** Persists a new document and returns it. */
  create(data: CreateDocumentData): Promise<EmployeeDocumentData>
}

/** Capability: record a signature on a document. */
export interface ISignDocument {
  /** Stores signature metadata on a document and returns the updated entity. */
  sign(id: string, data: SignDocumentData): Promise<EmployeeDocumentData>
}

/** Capability: archive a document. */
export interface IArchiveDocument {
  /** Marks a document as archived at the given instant and returns it. */
  archive(id: string, archivedAt: Date): Promise<EmployeeDocumentData>
}

/** Capability: read documents nearing expiry. */
export interface IFindExpiringDocuments {
  /** @returns documents expiring within the given number of days, with employee data */
  findExpiring(daysFromNow: number): Promise<ExpiringDocumentData[]>
}

// ── Use-case contracts — composed from exactly the needed capabilities ───────

/** Dependencies of the list-documents use case. */
export type ListDocumentsRepository = IFindDocumentsByEmployee

/** Dependencies of the get-document use case. */
export type GetDocumentRepository = IFindDocumentById

/** Dependencies of the create-document use case. */
export type CreateDocumentRepository = ICreateDocument

/** Dependencies of the sign-document use case. */
export type SignDocumentRepository = IFindDocumentById & ISignDocument

/** Dependencies of the archive-document use case. */
export type ArchiveDocumentRepository = IFindDocumentById & IArchiveDocument

/** Dependencies of the renew-document use case. */
export type RenewDocumentRepository = IFindDocumentById & ICreateDocument

/** Dependencies of the list-expiring-documents use case. */
export type ListExpiringDocumentsRepository = IFindExpiringDocuments

// ── Full persistence port — the single adapter implements every capability ───

/**
 * Persistence port for employee documents. Implemented by one adapter in the
 * boundary layer, which therefore satisfies every composed use-case contract.
 */
export interface IDocumentRepository
  extends IFindDocumentsByEmployee, IFindDocumentById, ICreateDocument,
          ISignDocument, IArchiveDocument, IFindExpiringDocuments {}
