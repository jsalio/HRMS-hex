import type { EmployeeDocumentData, ExpiringDocumentData } from '@hrms/core/contracts/documents'

/**
 * Converts an employee document read model into its serialisable API DTO.
 *
 * @param d - employee document data coming from the documents contract
 * @returns the flat document DTO exposed by the HTTP layer
 */
export function toDocumentDTO(d: EmployeeDocumentData) {
  return {
    id:            d.id,
    employeeId:    d.employeeId,
    templateId:    d.templateId,
    name:          d.name,
    type:          d.type,
    status:        d.status,
    fileUrl:       d.fileUrl,
    fileHash:      d.fileHash,
    signedAt:      d.signedAt,
    signedBy:      d.signedBy,
    archivedAt:    d.archivedAt,
    expiresAt:     d.expiresAt,
    renewedFromId: d.renewedFromId,
    createdAt:     d.createdAt,
    updatedAt:     d.updatedAt,
  }
}

/**
 * Converts an expiring document read model into its API DTO, including the
 * related employee reference alongside the base document fields.
 *
 * @param d - expiring document data coming from the documents contract
 * @returns the document DTO augmented with its `employee` reference
 */
export function toExpiringDocumentDTO(d: ExpiringDocumentData) {
  return { ...toDocumentDTO(d), employee: d.employee }
}
