import { describe, it, expect, mock } from 'bun:test'
import { SignDocumentUseCase } from '../../usecases/sign-document.usecase'
import { ValidationError } from '../../domain/errors'
import type { SignDocumentRepository, EmployeeDocumentData } from '../../contracts/documents'

const now = new Date('2026-01-01T00:00:00Z')

const mockDoc: EmployeeDocumentData = {
  id: 'doc-1', employeeId: 'emp-1', templateId: null,
  name: 'Employment Contract', type: 'contract', status: 'PENDING',
  fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
  signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
  renewalNotifiedAt: null, renewedFromId: null,
  createdAt: now, updatedAt: now,
}

function makeRepo(): SignDocumentRepository {
  return {
    findById: mock(async () => mockDoc),
    sign:     mock(async () => ({ ...mockDoc, status: 'SIGNED' as const, fileHash: 'a'.repeat(64), signedAt: now, signedBy: 'user-1' })),
  }
}

describe('SignDocumentUseCase', () => {
  it('signDocument_transitions_to_SIGNED_and_stores_hash', async () => {
    const documentRepo = makeRepo()
    const uc = new SignDocumentUseCase(documentRepo)

    const result = await uc.execute('doc-1', 'a'.repeat(64), 'user-1')

    expect(documentRepo.sign).toHaveBeenCalledWith('doc-1', expect.objectContaining({
      fileHash: 'a'.repeat(64),
      signedBy: 'user-1',
    }))
    expect(result.status).toBe('SIGNED')
  })

  it('signDocument_throws_ValidationError_when_already_SIGNED', async () => {
    const documentRepo = makeRepo()
    ;(documentRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockDoc, status: 'SIGNED' })
    const uc = new SignDocumentUseCase(documentRepo)

    await expect(uc.execute('doc-1', 'a'.repeat(64), 'user-1')).rejects.toBeInstanceOf(ValidationError)
    expect(documentRepo.sign).not.toHaveBeenCalled()
  })
})
