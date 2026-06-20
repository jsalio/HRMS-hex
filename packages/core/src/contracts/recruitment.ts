import type { CandidateData, CandidateStatus } from '../domain/candidate'

export type { CandidateData, CandidateStatus }

/** The possible states for a job posting. */
export type PostingStatus = 'OPEN' | 'CLOSED' | 'ON_HOLD'

/** Persistent data for a job posting record. */
export interface JobPostingData {
  id: string
  title: string
  departmentId: string
  description: string
  requirements: string | null
  status: PostingStatus
  createdAt: Date
  closedAt: Date | null
}

/** Input shape for creating a new job posting. */
export interface CreateJobPostingInput {
  title: string
  departmentId: string
  description: string
  requirements?: string
}

/** Input shape for registering a new candidate application. */
export interface CreateCandidateInput {
  postingId: string
  fullName: string
  email: string
  phone?: string
  resumeUrl?: string
}

/** Input shape for the atomic hire transaction. */
export interface HireInput {
  /** ISO date string (YYYY-MM-DD) — the employee's first day. */
  hireDate: string
  /** Annual salary in the organisation's base currency — must be > 0. */
  salary: number
  departmentId: string
  jobTitle: string
  corporateEmail: string
  documentId: string
}

/** Result returned by a successful hire transaction. */
export interface HireResult {
  /** The updated candidate record with status HIRED and hiredAsEmployeeId set. */
  candidate: CandidateData
  /** The id of the newly created employee record. */
  employeeId: string
}

// ── Atomic capabilities ──────────────────────────────────────────────────────

/** Capability: list job postings with optional status filter. */
export interface IFindJobPostings {
  /** @returns all postings matching the optional status filter, ordered by creation date */
  listJobPostings(status?: PostingStatus): Promise<JobPostingData[]>
}

/** Capability: read a single job posting by identifier. */
export interface IFindJobPostingById {
  /** @returns the posting with the given id, or null when none exists */
  findJobPostingById(id: string): Promise<JobPostingData | null>
}

/** Capability: persist a new job posting. */
export interface ICreateJobPosting {
  /** Persists a new posting with status OPEN and returns it with its generated id. */
  createJobPosting(input: CreateJobPostingInput): Promise<JobPostingData>
}

/** Capability: update an existing job posting's fields or status. */
export interface IUpdateJobPosting {
  /** Applies the patch fields to the posting and returns the updated record. */
  updateJobPosting(id: string, patch: Partial<Omit<JobPostingData, 'id' | 'createdAt'>>): Promise<JobPostingData>
}

/** Capability: list all candidates for a job posting. */
export interface IFindCandidates {
  /** @returns all candidates for the given posting, ordered by application date */
  listCandidates(postingId: string): Promise<CandidateData[]>
}

/** Capability: read a single candidate by identifier. */
export interface IFindCandidateById {
  /** @returns the candidate with the given id, or null when none exists */
  findCandidateById(id: string): Promise<CandidateData | null>
}

/** Capability: persist a new candidate application. */
export interface ICreateCandidate {
  /** Persists a new candidate with status APPLIED and returns it with its generated id. */
  createCandidate(input: CreateCandidateInput): Promise<CandidateData>
}

/** Capability: check duplicate applications before inserting. */
export interface IExistsCandidateByEmailAndPosting {
  /** @returns true when a candidate with this email already exists for the given posting */
  existsCandidateByEmailAndPosting(email: string, postingId: string): Promise<boolean>
}

/** Capability: advance a candidate's pipeline status. */
export interface IUpdateCandidateStatus {
  /**
   * Persists the new pipeline status and optional notes.
   *
   * @returns the updated candidate record
   */
  updateCandidateStatus(id: string, status: CandidateStatus, notes?: string): Promise<CandidateData>
}

/** Capability: execute the atomic hire transaction. */
export interface IHireCandidate {
  /**
   * Atomically creates the employee record, seeds onboarding steps,
   * creates a user account, and marks the candidate as HIRED.
   *
   * @param candidateId - identifier of the candidate to hire
   * @param input - all data required to onboard the new employee
   * @returns the updated candidate and the new employee's id
   */
  hire(candidateId: string, input: HireInput): Promise<HireResult>
}

// ── Capability for department validation in posting creation ─────────────────

/**
 * Minimal repository contract for validating department existence.
 * Satisfied by the full DepartmentRepository.
 */
export interface CreateJobPostingDeptRepository {
  /** @returns the department with the given id, or null when none exists */
  findById(id: string): Promise<{ id: string; name: string } | null>
}

// ── Use-case contracts ───────────────────────────────────────────────────────

/** Dependencies of the list-job-postings use case. */
export type ListJobPostingsRepository = IFindJobPostings

/** Dependencies of the create-job-posting use case (recruitment repo). */
export type CreateJobPostingRepository = ICreateJobPosting

/** Dependencies of the update-job-posting use case. */
export type UpdateJobPostingRepository = IFindJobPostingById & IUpdateJobPosting

/** Dependencies of the list-candidates use case. */
export type ListCandidatesRepository = IFindCandidates

/** Dependencies of the get-candidate use case. */
export type GetCandidateRepository = IFindCandidateById

/** Dependencies of the create-candidate use case. */
export type CreateCandidateRepository = IExistsCandidateByEmailAndPosting & ICreateCandidate

/** Dependencies of the advance-candidate-status use case. */
export type AdvanceCandidateStatusRepository = IFindCandidateById & IUpdateCandidateStatus

/** Dependencies of the hire-candidate use case. */
export type HireCandidateRepository = IFindCandidateById & IHireCandidate

// ── Full persistence port ────────────────────────────────────────────────────

/**
 * Persistence port for the entire recruitment module. A single adapter in the
 * boundary layer implements all capabilities, satisfying every composed
 * use-case contract above.
 */
export interface IRecruitmentRepository
  extends IFindJobPostings, IFindJobPostingById, ICreateJobPosting, IUpdateJobPosting,
          IFindCandidates, IFindCandidateById, ICreateCandidate,
          IExistsCandidateByEmailAndPosting, IUpdateCandidateStatus, IHireCandidate {}
