import { describe, it, expect, mock } from 'bun:test'
import { ListCandidatesUseCase } from '@hrms/core/usecases/list-candidates.usecase'
import type { ListCandidatesRepository, CandidateData } from '@hrms/core/contracts/recruitment'

const candidateData: CandidateData = {
  id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
  email: 'ana@test.com', phone: null, resumeUrl: null,
  status: 'APPLIED', notes: null, hiredAsEmployeeId: null,
  createdAt: new Date(), updatedAt: new Date(),
}

function makeRepo(overrides: Partial<ListCandidatesRepository> = {}): ListCandidatesRepository {
  return {
    listCandidates: mock(() => Promise.resolve([candidateData])),
    ...overrides,
  }
}

describe('ListCandidatesUseCase', () => {
  // Test 2.16
  it('given_posting_id_when_listing_candidates_then_passes_posting_id_to_repository', async () => {
    const repo = makeRepo()
    const useCase = new ListCandidatesUseCase(repo)
    await useCase.execute({ postingId: 'p-1' })
    expect(repo.listCandidates).toHaveBeenCalledWith('p-1')
  })

  it('given_repository_returns_candidates_then_use_case_returns_them', async () => {
    const useCase = new ListCandidatesUseCase(makeRepo())
    const result = await useCase.execute({ postingId: 'p-1' })
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('Ana García')
  })
})
