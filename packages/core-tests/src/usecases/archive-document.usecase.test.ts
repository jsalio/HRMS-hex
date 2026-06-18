import { describe, it, expect, mock } from 'bun:test'
import { ArchiveDocumentUseCase } from '@hrms/core/usecases/archive-document.usecase'
import { ValidationError } from '@hrms/core/domain/errors'
import type { ArchiveDocumentRepository, EmployeeDocumentData } from '@hrms/core/contracts/documents'

const now = new Date('2026-01-01T00:00:00Z')

const mockDoc: EmployeeDocumentData = {
  id: 'doc-1', employeeId: 'emp-1', templateId: null,
  name: 'Employment Contract', type: 'contract', status: 'PENDING',
  fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
  signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
  renewalNotifiedAt: null, renewedFromId: null,
  createdAt: now, updatedAt: now,
}

function makeRepo(): ArchiveDocumentRepository {
  return {
    findById: mock(async () => mockDoc),
    archive:  mock(async () => ({ ...mockDoc, status: 'ARCHIVED' as const, archivedAt: now })),
  }
}

describe('ArchiveDocumentUseCase', () => {
  it('archiveDocument_transitions_to_ARCHIVED', async () => {
    const documentRepo = makeRepo()
    ;(documentRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockDoc, status: 'SIGNED' })
    const uc = new ArchiveDocumentUseCase(documentRepo)

    const result = await uc.execute('doc-1')

    expect(documentRepo.archive).toHaveBeenCalledWith('doc-1', expect.any(Date))
    expect(result.status).toBe('ARCHIVED')
  })

  it('archiveDocument_throws_ValidationError_when_PENDING', async () => {
    const documentRepo = makeRepo()
    const uc = new ArchiveDocumentUseCase(documentRepo)

    await expect(uc.execute('doc-1')).rejects.toBeInstanceOf(ValidationError)
    expect(documentRepo.archive).not.toHaveBeenCalled()
  })
})
