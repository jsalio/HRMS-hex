import { describe, it, expect, mock } from 'bun:test'
import { CreateDocumentUseCase } from '@hrms/core/usecases/create-document.usecase'
import { NotFoundError, ValidationError } from '@hrms/core/domain/errors'
import type { CreateDocumentRepository, EmployeeDocumentData } from '@hrms/core/contracts/documents'
import type { IEmployeeRepository } from '@hrms/core/contracts/employees'

const now = new Date('2026-01-01T00:00:00Z')

const mockEmployee = {
  id: 'emp-1', fullName: 'Ana García', documentId: 'DNI-001',
  corporateEmail: 'ana@hrms.com', department: { id: 'd-1', name: 'Engineering' },
  jobTitle: 'Developer', salary: 5000, status: 'ACTIVE' as const,
  hireDate: now, terminationDate: null, createdAt: now, updatedAt: now,
  onboarding: [],
}

const mockDoc: EmployeeDocumentData = {
  id: 'doc-1', employeeId: 'emp-1', templateId: null,
  name: 'Employment Contract', type: 'contract', status: 'PENDING',
  fileUrl: 'https://s3.example.com/doc.pdf', fileHash: null,
  signedAt: null, signedBy: null, archivedAt: null, expiresAt: null,
  renewalNotifiedAt: null, renewedFromId: null,
  createdAt: now, updatedAt: now,
}

function makeRepos() {
  const documentRepo: CreateDocumentRepository = {
    create: mock(async () => mockDoc),
  }

  const employeeRepo = {
    findAll:              mock(async () => ({ data: [], total: 0, page: 1 })),
    findById:             mock(async () => mockEmployee),
    findByEmail:          mock(async () => null),
    findByDocumentId:     mock(async () => null),
    create:               mock(async () => mockEmployee),
    update:               mock(async () => mockEmployee),
    terminate:            mock(async () => mockEmployee),
    findOnboarding:       mock(async () => []),
    updateOnboardingStep: mock(async () => ({} as any)),
  } as unknown as IEmployeeRepository

  return { documentRepo, employeeRepo }
}

describe('CreateDocumentUseCase', () => {
  it('createDocument_creates_PENDING_document_for_active_employee', async () => {
    const { documentRepo, employeeRepo } = makeRepos()
    const uc = new CreateDocumentUseCase(documentRepo, employeeRepo)

    const result = await uc.execute({
      employeeId: 'emp-1', name: 'Contract', type: 'contract',
      fileUrl: 'https://s3.example.com/doc.pdf',
    })

    expect(documentRepo.create).toHaveBeenCalledTimes(1)
    expect(result.id).toBe('doc-1')
  })

  it('createDocument_throws_NotFoundError_when_employee_not_found', async () => {
    const { documentRepo, employeeRepo } = makeRepos()
    ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue(null)
    const uc = new CreateDocumentUseCase(documentRepo, employeeRepo)

    await expect(
      uc.execute({ employeeId: 'emp-x', name: 'X', type: 'contract', fileUrl: 'https://s3.example.com/x.pdf' })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('createDocument_throws_ValidationError_when_employee_is_INACTIVE', async () => {
    const { documentRepo, employeeRepo } = makeRepos()
    ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockEmployee, status: 'INACTIVE' })
    const uc = new CreateDocumentUseCase(documentRepo, employeeRepo)

    await expect(
      uc.execute({ employeeId: 'emp-1', name: 'X', type: 'contract', fileUrl: 'https://s3.example.com/x.pdf' })
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
