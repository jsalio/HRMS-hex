import type { UpdateJobPostingRepository, JobPostingData, PostingStatus } from '../contracts/recruitment'
import { NotFoundError } from '../domain/errors'

/** Subset of job posting fields that can be updated. */
export interface UpdateJobPostingInput {
  title?:        string
  description?:  string
  requirements?: string
  status?:       PostingStatus
  closedAt?:     Date | null
}

/**
 * Applies a partial update to an existing job posting.
 */
export class UpdateJobPostingUseCase {
  /**
   * @param repo - capabilities to read and update job postings
   */
  constructor(private readonly repo: UpdateJobPostingRepository) {}

  /**
   * Finds the posting by id and applies the given patch.
   *
   * @param id - identifier of the posting to update
   * @param input - fields to update; omitted fields are left unchanged
   * @returns the updated job posting record
   * @throws {NotFoundError} when no posting exists with the given id
   */
  async execute(id: string, input: UpdateJobPostingInput): Promise<JobPostingData> {
    const existing = await this.repo.findJobPostingById(id)
    if (!existing) throw new NotFoundError(`Job posting "${id}" not found`)

    return this.repo.updateJobPosting(id, input)
  }
}
