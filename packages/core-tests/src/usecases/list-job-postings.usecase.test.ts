import { describe, it, expect, mock } from 'bun:test'
import { ListJobPostingsUseCase } from '@hrms/core/usecases/list-job-postings.usecase'
import type { ListJobPostingsRepository, JobPostingData } from '@hrms/core/contracts/recruitment'

const postingData: JobPostingData = {
  id: 'p-1', title: 'Dev Senior', departmentId: 'd-1',
  description: 'We are looking for a senior dev.', requirements: null,
  status: 'OPEN', createdAt: new Date(), closedAt: null,
}

function makeRepo(overrides: Partial<ListJobPostingsRepository> = {}): ListJobPostingsRepository {
  return {
    listJobPostings: mock(() => Promise.resolve([postingData])),
    ...overrides,
  }
}

describe('ListJobPostingsUseCase', () => {
  // Test 2.3
  it('given_status_filter_when_listing_postings_then_passes_filter_to_repository', async () => {
    const repo = makeRepo()
    const useCase = new ListJobPostingsUseCase(repo)
    await useCase.execute({ status: 'OPEN' })
    expect(repo.listJobPostings).toHaveBeenCalledWith('OPEN')
  })

  it('given_no_filter_when_listing_postings_then_calls_repository_with_undefined', async () => {
    const repo = makeRepo()
    const useCase = new ListJobPostingsUseCase(repo)
    await useCase.execute()
    expect(repo.listJobPostings).toHaveBeenCalledWith(undefined)
  })

  it('given_repository_returns_postings_then_use_case_returns_them', async () => {
    const useCase = new ListJobPostingsUseCase(makeRepo())
    const result = await useCase.execute()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Dev Senior')
  })
})
