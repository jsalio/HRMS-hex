import type { GetCandidateRepository, CandidateData } from '../contracts/recruitment'
import { NotFoundError } from '../domain/errors'

/**
 * Retrieves a single candidate by identifier.
 */
export class GetCandidateUseCase {
  /**
   * @param repo - capability to read a candidate by id
   */
  constructor(private readonly repo: GetCandidateRepository) {}

  /**
   * Finds a candidate by its id.
   *
   * @param id - identifier of the candidate to retrieve
   * @returns the matching candidate data
   * @throws {NotFoundError} when no candidate exists with the given id
   */
  async execute(id: string): Promise<CandidateData> {
    const candidate = await this.repo.findCandidateById(id)
    if (!candidate) throw new NotFoundError(`Candidate "${id}" not found`)
    return candidate
  }
}
