import type { ListJobPostingsRepository, JobPostingData, PostingStatus } from '../contracts/recruitment'

/** Input for filtering the job postings list. */
export interface ListJobPostingsInput {
  /** When provided, only postings with this status are returned. */
  status?: PostingStatus
}

/**
 * Returns all job postings, optionally filtered by status.
 */
export class ListJobPostingsUseCase {
  /**
   * @param repo - capability to read job postings from the repository
   */
  constructor(private readonly repo: ListJobPostingsRepository) {}

  /**
   * Retrieves job postings, applying an optional status filter.
   *
   * @param input - optional status to filter by
   * @returns the matching job postings ordered by creation date
   */
  async execute(input: ListJobPostingsInput = {}): Promise<JobPostingData[]> {
    return this.repo.listJobPostings(input.status)
  }
}
