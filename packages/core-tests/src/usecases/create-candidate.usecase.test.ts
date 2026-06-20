import { describe, it, expect, mock } from 'bun:test'
import { CreateCandidateUseCase } from '@hrms/core/usecases/create-candidate.usecase'
import { ConflictError } from '@hrms/core/domain/errors'
import type { CreateCandidateRepository, CandidateData } from '@hrms/core/contracts/recruitment'

const candidateData: CandidateData = {
  id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
  email: 'ana@test.com', phone: null, resumeUrl: null,
  status: 'APPLIED', notes: null, hiredAsEmployeeId: null,
  createdAt: new Date(), updatedAt: new Date(),
}

function makeRepo(overrides: Partial<CreateCandidateRepository> = {}): CreateCandidateRepository {
  return {
    existsCandidateByEmailAndPosting: mock(() => Promise.resolve(false)),
    createCandidate:                  mock(() => Promise.resolve(candidateData)),
    ...overrides,
  }
}

const validInput = { postingId: 'p-1', fullName: 'Ana García', email: 'ana@test.com' }

describe('CreateCandidateUseCase', () => {
  // Test 2.4
  it('given_valid_input_when_creating_candidate_then_returns_candidate_with_APPLIED_status', async () => {
    const useCase = new CreateCandidateUseCase(makeRepo())
    const result = await useCase.execute(validInput)
    expect(result.status).toBe('APPLIED')
  })

  // Test 2.5
  it('given_duplicate_email_for_same_posting_when_creating_candidate_then_throws_ConflictError', async () => {
    const repo = makeRepo({
      existsCandidateByEmailAndPosting: mock(() => Promise.resolve(true)),
    })
    const useCase = new CreateCandidateUseCase(repo)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })
})
