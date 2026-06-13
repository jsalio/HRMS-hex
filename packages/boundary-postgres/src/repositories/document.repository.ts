import type { Sql } from 'postgres'
import type {
  IDocumentRepository,
  EmployeeDocumentData,
  ExpiringDocumentData,
  DocumentStatus,
  DocumentType,
} from '@hrms/core/contracts/documents'

interface DocumentRow {
  id: string
  employee_id: string
  template_id: string | null
  name: string
  type: string
  status: string
  file_url: string
  file_hash: string | null
  signed_at: Date | null
  signed_by: string | null
  archived_at: Date | null
  expires_at: Date | null
  renewal_notified_at: Date | null
  renewed_from_id: string | null
  created_at: Date
  updated_at: Date
}

function toData(row: DocumentRow): EmployeeDocumentData {
  return {
    id:                row.id,
    employeeId:        row.employee_id,
    templateId:        row.template_id,
    name:              row.name,
    type:              row.type as DocumentType,
    status:            row.status as DocumentStatus,
    fileUrl:           row.file_url,
    fileHash:          row.file_hash,
    signedAt:          row.signed_at,
    signedBy:          row.signed_by,
    archivedAt:        row.archived_at,
    expiresAt:         row.expires_at,
    renewalNotifiedAt: row.renewal_notified_at,
    renewedFromId:     row.renewed_from_id,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  }
}

export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly sql: Sql) {}

  async findByEmployee(
    employeeId: string,
    filters: { status?: DocumentStatus; type?: DocumentType } = {},
  ): Promise<EmployeeDocumentData[]> {
    const rows = await this.sql<DocumentRow[]>`
      SELECT * FROM employee_documents
      WHERE employee_id = ${employeeId}
        ${filters.status ? this.sql`AND status = ${filters.status}` : this.sql``}
        ${filters.type   ? this.sql`AND type   = ${filters.type}`   : this.sql``}
      ORDER BY created_at DESC
    `
    return rows.map(toData)
  }

  async findById(id: string): Promise<EmployeeDocumentData | null> {
    const [row] = await this.sql<DocumentRow[]>`
      SELECT * FROM employee_documents WHERE id = ${id}
    `
    return row ? toData(row) : null
  }

  async create(data: {
    employeeId: string
    templateId?: string | null
    name: string
    type: DocumentType
    fileUrl: string
    expiresAt?: Date | null
    renewedFromId?: string | null
  }): Promise<EmployeeDocumentData> {
    const [row] = await this.sql<DocumentRow[]>`
      INSERT INTO employee_documents
        (employee_id, template_id, name, type, file_url, expires_at, renewed_from_id)
      VALUES
        (${data.employeeId}, ${data.templateId ?? null}, ${data.name}, ${data.type},
         ${data.fileUrl}, ${data.expiresAt ?? null}, ${data.renewedFromId ?? null})
      RETURNING *
    `
    return toData(row!)
  }

  async sign(
    id: string,
    data: { fileHash: string; signedBy: string; signedAt: Date },
  ): Promise<EmployeeDocumentData> {
    const [row] = await this.sql<DocumentRow[]>`
      UPDATE employee_documents
      SET status    = 'SIGNED',
          file_hash = ${data.fileHash},
          signed_by = ${data.signedBy},
          signed_at = ${data.signedAt},
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toData(row!)
  }

  async archive(id: string, archivedAt: Date): Promise<EmployeeDocumentData> {
    const [row] = await this.sql<DocumentRow[]>`
      UPDATE employee_documents
      SET status      = 'ARCHIVED',
          archived_at = ${archivedAt},
          updated_at  = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toData(row!)
  }

  async findExpiring(daysFromNow: number): Promise<ExpiringDocumentData[]> {
    const rows = await this.sql<(DocumentRow & {
      employee_full_name: string
      employee_corporate_email: string
    })[]>`
      SELECT d.*, e.full_name AS employee_full_name, e.corporate_email AS employee_corporate_email
      FROM employee_documents d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.expires_at IS NOT NULL
        AND d.expires_at <= CURRENT_DATE + (${daysFromNow} * INTERVAL '1 day')
        AND d.status != 'ARCHIVED'
      ORDER BY d.expires_at ASC
    `
    return rows.map(r => ({
      ...toData(r),
      employee: {
        id:             r.employee_id,
        fullName:       r.employee_full_name,
        corporateEmail: r.employee_corporate_email,
      },
    }))
  }
}
