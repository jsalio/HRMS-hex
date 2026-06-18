import { describe, it, expect, mock } from 'bun:test'
import { ListExpiringDocumentsUseCase } from '../../usecases/list-expiring-documents.usecase'
import type { ListExpiringDocumentsRepository, EmployeeDocumentData } from '../../contracts/documents'

const now = new Date('2026-01-01T00:00:00Z')

const mockDoc: EmployeeDocumentData = {
  id: 'doc-1', employeeId: 'emp-1', templateId: null,
  name: 'Employment Contract', type: 'contract', status: 'PENDING',
  fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
  signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
  renewalNotifiedAt: null, renewedFromId: null,
  createdAt: now, updatedAt: now,
}

function makeRepo(): ListExpiringDocumentsRepository {
  return {
    findExpiring: mock(async () => []),
  }
}

describe('ListExpiringDocumentsUseCase', () => {
  it('listExpiringDocuments_delegates_to_repository', async () => {
    const documentRepo = makeRepo()
    ;(documentRepo.findExpiring as ReturnType<typeof mock>).mockResolvedValue([
      { ...mockDoc, employee: { id: 'emp-1', fullName: 'Ana García', corporateEmail: 'ana@hrms.com' } },
    ])
    const uc = new ListExpiringDocumentsUseCase(documentRepo)

    const result = await uc.execute(30)

    expect(documentRepo.findExpiring).toHaveBeenCalledWith(30)
    expect(result[0]).toHaveProperty('employee')
  })
})
