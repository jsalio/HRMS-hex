import type { CreateCandidateRepository, CandidateData, CreateCandidateInput } from '../contracts/recruitment'
import { ConflictError } from '../domain/errors'

/**
 * Registers a new candidate application for a job posting.
 * Enforces the uniqueness constraint: one application per email per posting.
 */
export class CreateCandidateUseCase {
  /**
   * @param repo - capabilities to check duplicate applications and persist the candidate
   */
  constructor(private readonly repo: CreateCandidateRepository) {}

  /**
   * Validates uniqueness and persists the candidate with status APPLIED.
   *
   * @param input - posting id, candidate contact information
   * @returns the created candidate record
   * @throws {ConflictError} when a candidate with the same email already applied to this posting
   */
  async execute(input: CreateCandidateInput): Promise<CandidateData> {
    const exists = await this.repo.existsCandidateByEmailAndPosting(input.email, input.postingId)
    if (exists) {
      throw new ConflictError(
        `A candidate with email "${input.email}" has already applied to this posting`
      )
    }

    return this.repo.createCandidate(input)
  }
}
