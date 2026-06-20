import { describe, it, expect, mock } from 'bun:test'
import { AdvanceCandidateStatusUseCase } from '@hrms/core/usecases/advance-candidate-status.usecase'
import { NotFoundError, ValidationError } from '@hrms/core/domain/errors'
import type { AdvanceCandidateStatusRepository, CandidateData } from '@hrms/core/contracts/recruitment'

const appliedCandidate: CandidateData = {
  id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
  email: 'ana@test.com', phone: null, resumeUrl: null,
  status: 'APPLIED', notes: null, hiredAsEmployeeId: null,
  createdAt: new Date(), updatedAt: new Date(),
}
const hiredCandidate: CandidateData  = { ...appliedCandidate, status: 'HIRED', hiredAsEmployeeId: 'emp-1' }
const screeningCandidate: CandidateData = { ...appliedCandidate, status: 'SCREENING' }

function makeRepo(overrides: Partial<AdvanceCandidateStatusRepository> = {}): AdvanceCandidateStatusRepository {
  return {
    findCandidateById:      mock(() => Promise.resolve(appliedCandidate)),
    updateCandidateStatus:  mock(() => Promise.resolve(screeningCandidate)),
    ...overrides,
  }
}

describe('AdvanceCandidateStatusUseCase', () => {
  // Test 2.6 — covers Invariant 1
  it('given_APPLIED_candidate_when_advancing_to_invalid_status_then_throws_ValidationError', async () => {
    const useCase = new AdvanceCandidateStatusUseCase(makeRepo())
    await expect(
      useCase.execute({ candidateId: 'c-1', status: 'INTERVIEW' })
    ).rejects.toThrow(ValidationError)
  })

  // Test 2.7 — covers Invariant 2
  it('given_HIRED_candidate_when_advancing_status_then_throws_ValidationError', async () => {
    const repo = makeRepo({ findCandidateById: mock(() => Promise.resolve(hiredCandidate)) })
    const useCase = new AdvanceCandidateStatusUseCase(repo)
    await expect(
      useCase.execute({ candidateId: 'c-1', status: 'REJECTED' })
    ).rejects.toThrow(ValidationError)
  })

  // Test 2.8
  it('given_APPLIED_candidate_when_advancing_to_SCREENING_then_calls_repo_updateStatus', async () => {
    const repo = makeRepo()
    const useCase = new AdvanceCandidateStatusUseCase(repo)
    const result = await useCase.execute({ candidateId: 'c-1', status: 'SCREENING' })
    expect(repo.updateCandidateStatus).toHaveBeenCalledWith('c-1', 'SCREENING', undefined)
    expect(result.status).toBe('SCREENING')
  })

  // Test 2.15
  it('given_nonexistent_candidate_when_advancing_status_then_throws_NotFoundError', async () => {
    const repo = makeRepo({ findCandidateById: mock(() => Promise.resolve(null)) })
    const useCase = new AdvanceCandidateStatusUseCase(repo)
    await expect(
      useCase.execute({ candidateId: 'bad-id', status: 'SCREENING' })
    ).rejects.toThrow(NotFoundError)
  })
})
