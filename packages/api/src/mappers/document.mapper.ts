import type { EmployeeDocumentData, ExpiringDocumentData } from '@hrms/core/contracts/documents'

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

export function toExpiringDocumentDTO(d: ExpiringDocumentData) {
  return { ...toDocumentDTO(d), employee: d.employee }
}
