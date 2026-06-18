import { describe, it, expect, mock } from 'bun:test'
import { RenewDocumentUseCase } from '@hrms/core/usecases/renew-document.usecase'
import type { RenewDocumentRepository, EmployeeDocumentData } from '@hrms/core/contracts/documents'

const now = new Date('2026-01-01T00:00:00Z')

const mockDoc: EmployeeDocumentData = {
  id: 'doc-1', employeeId: 'emp-1', templateId: null,
  name: 'Employment Contract', type: 'contract', status: 'PENDING',
  fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
  signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
  renewalNotifiedAt: null, renewedFromId: null,
  createdAt: now, updatedAt: now,
}

function makeRepo(): RenewDocumentRepository {
  return {
    findById: mock(async () => mockDoc),
    create:   mock(async () => mockDoc),
  }
}

describe('RenewDocumentUseCase', () => {
  it('renewDocument_creates_new_PENDING_with_renewed_from_id', async () => {
    const documentRepo = makeRepo()
    const uc = new RenewDocumentUseCase(documentRepo)

    await uc.execute('doc-1', { fileUrl: 'https://s3.example.com/new.pdf' })

    expect(documentRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      renewedFromId: 'doc-1',
      fileUrl: 'https://s3.example.com/new.pdf',
    }))
  })
})
