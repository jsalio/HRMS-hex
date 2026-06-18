import { describe, it, expect } from 'bun:test'
import { EmployeeDocument } from '@hrms/core/domain/employee-document'
import { ValidationError } from '@hrms/core/domain/errors'
import type { EmployeeDocumentData } from '@hrms/core/contracts/documents'

const now = new Date('2026-01-01T00:00:00Z')

function makeDoc(overrides: Partial<EmployeeDocumentData> = {}): EmployeeDocument {
  return new EmployeeDocument({
    id: 'doc-1', employeeId: 'emp-1', templateId: null,
    name: 'Employment Contract', type: 'contract', status: 'PENDING',
    fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
    signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
    renewalNotifiedAt: null, renewedFromId: null,
    createdAt: now, updatedAt: now,
    ...overrides,
  })
}

describe('EmployeeDocument', () => {
  describe('assertCanBeSigned', () => {
    it('given_PENDING_document_when_assertCanBeSigned_then_passes', () => {
      const doc = makeDoc({ status: 'PENDING' })
      expect(() => doc.assertCanBeSigned()).not.toThrow()
    })

    it('given_SIGNED_document_when_assertCanBeSigned_then_throws_ValidationError', () => {
      const doc = makeDoc({ status: 'SIGNED' })
      expect(() => doc.assertCanBeSigned()).toThrow(ValidationError)
    })

    it('given_ARCHIVED_document_when_assertCanBeSigned_then_throws_ValidationError', () => {
      const doc = makeDoc({ status: 'ARCHIVED' })
      expect(() => doc.assertCanBeSigned()).toThrow(ValidationError)
    })
  })

  describe('assertCanBeArchived', () => {
    it('given_SIGNED_document_when_assertCanBeArchived_then_passes', () => {
      const doc = makeDoc({ status: 'SIGNED' })
      expect(() => doc.assertCanBeArchived()).not.toThrow()
    })

    it('given_PENDING_document_when_assertCanBeArchived_then_throws_ValidationError', () => {
      const doc = makeDoc({ status: 'PENDING' })
      expect(() => doc.assertCanBeArchived()).toThrow(ValidationError)
    })
  })
})
