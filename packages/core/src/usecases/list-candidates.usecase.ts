import type { ListCandidatesRepository, CandidateData } from '../contracts/recruitment'

/**
 * Returns all candidates that applied to a given job posting.
 */
export class ListCandidatesUseCase {
  /**
   * @param repo - capability to read candidates by posting
   */
  constructor(private readonly repo: ListCandidatesRepository) {}

  /**
   * Retrieves all candidates for a posting, ordered by application date.
   *
   * @param input - the posting whose candidates are requested
   * @returns the candidate list for the posting
   */
  async execute(input: { postingId: string }): Promise<CandidateData[]> {
    return this.repo.listCandidates(input.postingId)
  }
}
