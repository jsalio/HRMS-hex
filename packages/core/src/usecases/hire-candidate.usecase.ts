import type { HireCandidateRepository, HireInput, HireResult } from '../contracts/recruitment'
import { Candidate } from '../domain/candidate'
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors'

/** Full input for the hire flow — candidate id plus all data needed for onboarding. */
export interface HireCandidateInput extends HireInput {
  candidateId: string
}

/**
 * Hires a candidate, atomically creating the employee record and initiating onboarding.
 * All business rule validations run in the use case before delegating to the repository
 * transaction, which maintains atomicity without leaking infrastructure concerns.
 */
export class HireCandidateUseCase {
  /**
   * @param repo - capabilities to read the candidate and execute the hire transaction
   */
  constructor(private readonly repo: HireCandidateRepository) {}

  /**
   * Validates all business rules and delegates the atomic hire transaction to the repository.
   *
   * @param input - candidate identifier plus all onboarding data
   * @returns the updated candidate (status=HIRED) and the new employee's id
   * @throws {NotFoundError} when no candidate exists with the given candidateId
   * @throws {ConflictError} when the candidate has already been hired (hiredAsEmployeeId is set)
   * @throws {ValidationError} when the candidate is not in OFFER status or salary is not positive
   */
  async execute(input: HireCandidateInput): Promise<HireResult> {
    const data = await this.repo.findCandidateById(input.candidateId)
    if (!data) throw new NotFoundError(`Candidate "${input.candidateId}" not found`)

    const candidate = new Candidate(data)

    if (candidate.hiredAsEmployeeId !== null) {
      throw new ConflictError(
        `Candidate "${input.candidateId}" has already been hired as employee "${candidate.hiredAsEmployeeId}"`
      )
    }

    candidate.assertReadyToHire()

    if (input.salary <= 0) {
      throw new ValidationError('Salary must be greater than 0')
    }

    const { candidateId, ...hireInput } = input
    return this.repo.hire(candidateId, hireInput)
  }
}
