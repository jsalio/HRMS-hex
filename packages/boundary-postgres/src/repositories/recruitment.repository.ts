import type { Sql } from 'postgres'
import type {
  IRecruitmentRepository,
  JobPostingData, CandidateData,
  CreateJobPostingInput, CreateCandidateInput,
  HireInput, HireResult,
  PostingStatus,
} from '@hrms/core/contracts/recruitment'
import type { CandidateStatus } from '@hrms/core/domain/candidate'
import { ONBOARDING_STEPS } from '@hrms/core/contracts/employees'

/** Maps a raw job_postings row to a JobPostingData. */
function toJobPosting(row: any): JobPostingData {
  return {
    id:           row.id,
    title:        row.title,
    departmentId: row.department_id,
    description:  row.description,
    requirements: row.requirements ?? null,
    status:       row.status as PostingStatus,
    createdAt:    row.created_at,
    closedAt:     row.closed_at ?? null,
  }
}

/** Maps a raw candidates row to a CandidateData. */
function toCandidate(row: any): CandidateData {
  return {
    id:                 row.id,
    postingId:          row.posting_id,
    fullName:           row.full_name,
    email:              row.email,
    phone:              row.phone ?? null,
    resumeUrl:          row.resume_url ?? null,
    status:             row.status as CandidateStatus,
    notes:              row.notes ?? null,
    hiredAsEmployeeId:  row.hired_as_employee_id ?? null,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  }
}

/**
 * Postgres adapter implementing IRecruitmentRepository over the
 * `job_postings` and `candidates` tables.
 */
export class RecruitmentRepository implements IRecruitmentRepository {
  /**
   * @param sql - Postgres client used to execute recruitment queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads all job postings, optionally filtered by status.
   *
   * @param status - when provided, only postings with this status are returned
   * @returns postings ordered by creation date descending
   */
  async listJobPostings(status?: PostingStatus): Promise<JobPostingData[]> {
    const rows = status
      ? await this.sql`SELECT * FROM job_postings WHERE status = ${status} ORDER BY created_at DESC`
      : await this.sql`SELECT * FROM job_postings ORDER BY created_at DESC`
    return rows.map(toJobPosting)
  }

  /**
   * Reads a single job posting by its identifier.
   *
   * @param id - identifier of the posting to read
   * @returns the matching posting, or null when none exists
   */
  async findJobPostingById(id: string): Promise<JobPostingData | null> {
    const rows = await this.sql`SELECT * FROM job_postings WHERE id = ${id}`
    return rows[0] ? toJobPosting(rows[0]) : null
  }

  /**
   * Persists a new job posting with status OPEN.
   *
   * @param input - title, department, description, and optional requirements
   * @returns the created posting with its generated id
   */
  async createJobPosting(input: CreateJobPostingInput): Promise<JobPostingData> {
    const rows = await this.sql`
      INSERT INTO job_postings (title, department_id, description, requirements)
      VALUES (${input.title}, ${input.departmentId}, ${input.description}, ${input.requirements ?? null})
      RETURNING *
    `
    return toJobPosting(rows[0])
  }

  /**
   * Applies a partial patch to an existing job posting.
   *
   * @param id - identifier of the posting to update
   * @param patch - subset of fields to overwrite
   * @returns the updated posting record
   */
  async updateJobPosting(id: string, patch: Partial<Omit<JobPostingData, 'id' | 'createdAt'>>): Promise<JobPostingData> {
    const rows = await this.sql`
      UPDATE job_postings SET
        title        = COALESCE(${patch.title        ?? null}, title),
        description  = COALESCE(${patch.description  ?? null}, description),
        requirements = COALESCE(${patch.requirements ?? null}, requirements),
        status       = COALESCE(${patch.status       ?? null}, status),
        closed_at    = COALESCE(${patch.closedAt     ?? null}, closed_at)
      WHERE id = ${id}
      RETURNING *
    `
    return toJobPosting(rows[0])
  }

  /**
   * Reads all candidates for a job posting, ordered by application date.
   *
   * @param postingId - identifier of the posting whose candidates are read
   * @returns the candidate list for the posting
   */
  async listCandidates(postingId: string): Promise<CandidateData[]> {
    const rows = await this.sql`
      SELECT * FROM candidates WHERE posting_id = ${postingId} ORDER BY created_at DESC
    `
    return rows.map(toCandidate)
  }

  /**
   * Reads a single candidate by its identifier.
   *
   * @param id - identifier of the candidate to read
   * @returns the matching candidate, or null when none exists
   */
  async findCandidateById(id: string): Promise<CandidateData | null> {
    const rows = await this.sql`SELECT * FROM candidates WHERE id = ${id}`
    return rows[0] ? toCandidate(rows[0]) : null
  }

  /**
   * Persists a new candidate with status APPLIED.
   *
   * @param input - candidate contact information and target posting
   * @returns the created candidate record
   */
  async createCandidate(input: CreateCandidateInput): Promise<CandidateData> {
    const rows = await this.sql`
      INSERT INTO candidates (posting_id, full_name, email, phone, resume_url)
      VALUES (
        ${input.postingId}, ${input.fullName}, ${input.email},
        ${input.phone ?? null}, ${input.resumeUrl ?? null}
      )
      RETURNING *
    `
    return toCandidate(rows[0])
  }

  /**
   * Checks whether a candidate with the given email has already applied to the posting.
   *
   * @param email - the applicant's email address
   * @param postingId - the posting to check against
   * @returns true when a duplicate exists
   */
  async existsCandidateByEmailAndPosting(email: string, postingId: string): Promise<boolean> {
    const rows = await this.sql`
      SELECT 1 FROM candidates WHERE email = ${email} AND posting_id = ${postingId} LIMIT 1
    `
    return rows.length > 0
  }

  /**
   * Updates a candidate's pipeline status and optional notes.
   *
   * @param id - identifier of the candidate to update
   * @param status - the new pipeline status
   * @param notes - optional notes to attach to the status change
   * @returns the updated candidate record
   */
  async updateCandidateStatus(id: string, status: CandidateStatus, notes?: string): Promise<CandidateData> {
    const rows = await this.sql`
      UPDATE candidates SET
        status     = ${status},
        notes      = COALESCE(${notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toCandidate(rows[0])
  }

  /**
   * Executes the atomic hire transaction: creates the employee record, seeds
   * onboarding steps, creates the user account (with a reset-required password),
   * and marks the candidate as HIRED — all in a single SQL transaction.
   *
   * @param candidateId - identifier of the candidate being hired
   * @param input - all data required to onboard the new employee
   * @returns the updated candidate record and the new employee's id
   */
  async hire(candidateId: string, input: HireInput): Promise<HireResult> {
    return this.sql.begin(async (tx) => {
      // 1. Create the employee record
      const empRows = await tx`
        INSERT INTO employees (full_name, document_id, corporate_email, department_id, job_title, salary, hire_date)
        VALUES (
          (SELECT full_name FROM candidates WHERE id = ${candidateId}),
          ${input.documentId},
          ${input.corporateEmail},
          ${input.departmentId},
          ${input.jobTitle},
          ${input.salary},
          ${input.hireDate}
        )
        RETURNING id
      `
      if (!empRows[0]) throw new Error('Employee insertion failed in hire transaction')
      const employeeId: string = empRows[0].id

      // 2. Seed the 5 onboarding steps
      await tx`
        INSERT INTO employee_onboarding (employee_id, step)
        SELECT ${employeeId}, step FROM unnest(${ONBOARDING_STEPS}::text[]) AS step
      `

      // 3. Create user account — password placeholder requires an admin reset
      const roleRows = await tx`SELECT id FROM roles WHERE name = 'employee' LIMIT 1`
      if (!roleRows[0]) throw new Error('"employee" role not found — check seed data')
      await tx`
        INSERT INTO users (email, password_hash, role_id, employee_id)
        VALUES (${input.corporateEmail}, 'RESET_REQUIRED', ${roleRows[0].id}, ${employeeId})
      `

      // 4. Mark the candidate as HIRED and link to the new employee
      const [candidateRow] = await tx`
        UPDATE candidates
        SET status = 'HIRED', hired_as_employee_id = ${employeeId}, updated_at = now()
        WHERE id = ${candidateId}
        RETURNING *
      `

      return { candidate: toCandidate(candidateRow), employeeId }
    })
  }
}
