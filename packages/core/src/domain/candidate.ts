import { ValidationError } from './errors'

/** The possible states in the candidate recruitment pipeline. */
export type CandidateStatus = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED'

/**
 * Valid next states for each pipeline stage.
 * An empty array marks a terminal state (no transitions allowed).
 */
export const CANDIDATE_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
}

/** Persistent data backing a Candidate entity. */
export interface CandidateData {
  id: string
  postingId: string
  fullName: string
  email: string
  phone: string | null
  resumeUrl: string | null
  status: CandidateStatus
  notes: string | null
  /** Set to the resulting employee id once the candidate is hired, otherwise null. */
  hiredAsEmployeeId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Domain entity representing a recruitment pipeline candidate.
 * Enforces the state machine and hiring pre-conditions.
 */
export class Candidate {
  /**
   * @param data - the persistent state backing this candidate instance
   */
  constructor(private readonly data: CandidateData) {}

  /** @returns the candidate's unique identifier */
  get id()     { return this.data.id }
  /** @returns the candidate's current pipeline status */
  get status() { return this.data.status }
  /** @returns the resulting employee id if the candidate was hired, or null */
  get hiredAsEmployeeId() { return this.data.hiredAsEmployeeId }

  /**
   * Returns whether the candidate is in a terminal state.
   * HIRED and REJECTED candidates cannot change status.
   *
   * @returns true when status is HIRED or REJECTED
   */
  isTerminal(): boolean {
    return this.data.status === 'HIRED' || this.data.status === 'REJECTED'
  }

  /**
   * Asserts that transitioning to `next` is a valid pipeline move
   * from the current status according to the state machine.
   *
   * @param next - the desired target status
   * @throws {ValidationError} when the transition is not allowed
   */
  assertCanTransitionTo(next: CandidateStatus): void {
    const allowed = CANDIDATE_TRANSITIONS[this.data.status]
    if (!allowed.includes(next)) {
      const hint = allowed.length ? allowed.join(', ') : 'none — terminal state'
      throw new ValidationError(
        `Cannot transition candidate from ${this.data.status} to ${next}. Allowed: ${hint}`
      )
    }
  }

  /**
   * Asserts that the candidate is in OFFER status.
   * This must pass before initiating the hire transaction.
   *
   * @throws {ValidationError} when the candidate's status is not OFFER
   */
  assertReadyToHire(): void {
    if (this.data.status !== 'OFFER') {
      throw new ValidationError(
        `Candidate must be in OFFER status to proceed with hire. Current status: ${this.data.status}`
      )
    }
  }
}
