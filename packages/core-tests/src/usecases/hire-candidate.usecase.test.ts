import { describe, it, expect, mock } from 'bun:test'
import { HireCandidateUseCase } from '@hrms/core/usecases/hire-candidate.usecase'
import { ConflictError, NotFoundError, ValidationError } from '@hrms/core/domain/errors'
import type { HireCandidateRepository, CandidateData, HireResult } from '@hrms/core/contracts/recruitment'

const offerCandidate: CandidateData = {
  id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
  email: 'ana@test.com', phone: null, resumeUrl: null,
  status: 'OFFER', notes: null, hiredAsEmployeeId: null,
  createdAt: new Date(), updatedAt: new Date(),
}
const hiredCandidate: CandidateData  = { ...offerCandidate, status: 'HIRED', hiredAsEmployeeId: 'emp-new' }
const alreadyHired: CandidateData    = { ...offerCandidate, status: 'HIRED', hiredAsEmployeeId: 'emp-1' }
const screeningCandidate: CandidateData = { ...offerCandidate, status: 'SCREENING', hiredAsEmployeeId: null }

const hireResult: HireResult = { candidate: hiredCandidate, employeeId: 'emp-new' }

function makeRepo(overrides: Partial<HireCandidateRepository> = {}): HireCandidateRepository {
  return {
    findCandidateById: mock(() => Promise.resolve(offerCandidate)),
    hire:              mock(() => Promise.resolve(hireResult)),
    ...overrides,
  }
}

const validInput = {
  candidateId: 'c-1',
  hireDate: '2026-06-19',
  salary: 50000,
  departmentId: 'd-1',
  jobTitle: 'Senior Dev',
  corporateEmail: 'ana@company.com',
  documentId: 'DOC-001',
}

describe('HireCandidateUseCase', () => {
  // Test 2.9 — covers Invariant 3
  it('given_OFFER_candidate_when_hiring_with_valid_data_then_calls_repo_hire_once', async () => {
    const repo = makeRepo()
    const useCase = new HireCandidateUseCase(repo)
    await useCase.execute(validInput)
    expect(repo.hire).toHaveBeenCalledTimes(1)
    expect(repo.hire).toHaveBeenCalledWith('c-1', {
      hireDate: '2026-06-19', salary: 50000, departmentId: 'd-1',
      jobTitle: 'Senior Dev', corporateEmail: 'ana@company.com', documentId: 'DOC-001',
    })
  })

  // Test 2.10 — covers Invariant 4
  it('given_already_hired_candidate_when_hiring_then_throws_ConflictError', async () => {
    const repo = makeRepo({ findCandidateById: mock(() => Promise.resolve(alreadyHired)) })
    const useCase = new HireCandidateUseCase(repo)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })

  // Test 2.11
  it('given_candidate_not_in_OFFER_status_when_hiring_then_throws_ValidationError', async () => {
    const repo = makeRepo({ findCandidateById: mock(() => Promise.resolve(screeningCandidate)) })
    const useCase = new HireCandidateUseCase(repo)
    await expect(useCase.execute(validInput)).rejects.toThrow(ValidationError)
  })

  // Test 2.12
  it('given_zero_salary_when_hiring_then_throws_ValidationError', async () => {
    const useCase = new HireCandidateUseCase(makeRepo())
    await expect(useCase.execute({ ...validInput, salary: 0 })).rejects.toThrow(ValidationError)
  })

  // Test 2.13
  it('given_negative_salary_when_hiring_then_throws_ValidationError', async () => {
    const useCase = new HireCandidateUseCase(makeRepo())
    await expect(useCase.execute({ ...validInput, salary: -1000 })).rejects.toThrow(ValidationError)
  })

  // Test 2.14
  it('given_nonexistent_candidate_when_hiring_then_throws_NotFoundError', async () => {
    const repo = makeRepo({ findCandidateById: mock(() => Promise.resolve(null)) })
    const useCase = new HireCandidateUseCase(repo)
    await expect(useCase.execute({ ...validInput, candidateId: 'bad-id' })).rejects.toThrow(NotFoundError)
  })
})
