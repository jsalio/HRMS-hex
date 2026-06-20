import type { AdvanceCandidateStatusRepository, CandidateData, CandidateStatus } from '../contracts/recruitment'
import { Candidate } from '../domain/candidate'
import { NotFoundError } from '../domain/errors'

/** Input for advancing or rejecting a candidate's pipeline status. */
export interface AdvanceCandidateStatusInput {
  candidateId: string
  /** The desired next status — must be a valid transition from the current status. */
  status: CandidateStatus
  /** Optional notes to attach to the status change. */
  notes?: string
}

/**
 * Advances or rejects a candidate in the recruitment pipeline.
 * Enforces the state machine: only valid transitions are allowed.
 */
export class AdvanceCandidateStatusUseCase {
  /**
   * @param repo - capabilities to read and update candidate status
   */
  constructor(private readonly repo: AdvanceCandidateStatusRepository) {}

  /**
   * Validates the pipeline transition and persists the new status.
   *
   * @param input - candidate id, target status, and optional notes
   * @returns the updated candidate record
   * @throws {NotFoundError} when no candidate exists with the given candidateId
   * @throws {ValidationError} when the requested status transition is not allowed
   */
  async execute(input: AdvanceCandidateStatusInput): Promise<CandidateData> {
    const data = await this.repo.findCandidateById(input.candidateId)
    if (!data) throw new NotFoundError(`Candidate "${input.candidateId}" not found`)

    const candidate = new Candidate(data)
    candidate.assertCanTransitionTo(input.status)

    return this.repo.updateCandidateStatus(input.candidateId, input.status, input.notes)
  }
}
