import { describe, it, expect, mock } from 'bun:test'
import { CreateJobPostingUseCase } from '@hrms/core/usecases/create-job-posting.usecase'
import { NotFoundError } from '@hrms/core/domain/errors'
import type { CreateJobPostingRepository, CreateJobPostingDeptRepository, JobPostingData } from '@hrms/core/contracts/recruitment'

const postingData: JobPostingData = {
  id: 'p-1', title: 'Dev Senior', departmentId: 'd-1',
  description: 'We are looking for a senior dev.', requirements: null,
  status: 'OPEN', createdAt: new Date(), closedAt: null,
}

const dept = { id: 'd-1', name: 'Engineering' }

function makeRepo(overrides: Partial<CreateJobPostingRepository> = {}): CreateJobPostingRepository {
  return {
    createJobPosting: mock(() => Promise.resolve(postingData)),
    ...overrides,
  }
}

function makeDeptRepo(overrides: Partial<CreateJobPostingDeptRepository> = {}): CreateJobPostingDeptRepository {
  return {
    findById: mock(() => Promise.resolve(dept)),
    ...overrides,
  }
}

describe('CreateJobPostingUseCase', () => {
  // Test 2.1
  it('given_valid_input_when_creating_job_posting_then_returns_posting_with_OPEN_status', async () => {
    const useCase = new CreateJobPostingUseCase(makeRepo(), makeDeptRepo())
    const result = await useCase.execute({ title: 'Dev Senior', departmentId: 'd-1', description: 'Desc' })
    expect(result.status).toBe('OPEN')
  })

  // Test 2.2
  it('given_nonexistent_department_when_creating_job_posting_then_throws_NotFoundError', async () => {
    const deptRepo = makeDeptRepo({ findById: mock(() => Promise.resolve(null)) })
    const useCase = new CreateJobPostingUseCase(makeRepo(), deptRepo)
    await expect(
      useCase.execute({ title: 'Dev Senior', departmentId: 'bad-id', description: 'Desc' })
    ).rejects.toThrow(NotFoundError)
  })
})
