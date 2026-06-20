import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

/** Represents a job posting as returned by the API. */
export interface JobPosting {
  id: string
  title: string
  departmentId: string
  description: string
  requirements: string | null
  status: 'OPEN' | 'CLOSED' | 'ON_HOLD'
  createdAt: string
  closedAt: string | null
}

/** The possible states in the candidate recruitment pipeline. */
export type CandidateStatus = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED'

/** Represents a candidate application as returned by the API. */
export interface Candidate {
  id: string
  postingId: string
  fullName: string
  email: string
  phone: string | null
  resumeUrl: string | null
  status: CandidateStatus
  notes: string | null
  hiredAsEmployeeId: string | null
  createdAt: string
  updatedAt: string
}

/** Result of a successful hire transaction. */
export interface HireResult {
  candidate: Candidate
  employeeId: string
}

/** Input for creating a new job posting. */
export interface CreateJobPostingDto {
  title: string
  departmentId: string
  description: string
  requirements?: string
}

/** Input for registering a new candidate. */
export interface CreateCandidateDto {
  postingId: string
  fullName: string
  email: string
  phone?: string
  resumeUrl?: string
}

/** Input for the hire form submission. */
export interface HireDto {
  hireDate: string
  salary: number
  departmentId: string
  jobTitle: string
  corporateEmail: string
  documentId: string
}

/**
 * HTTP client service for all recruitment-related API endpoints.
 */
@Injectable({ providedIn: 'root' })
export class RecruitmentService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api'

  /**
   * Fetches all job postings, optionally filtered by status.
   *
   * @param status - when provided, only postings with this status are returned
   * @returns the matching job postings
   */
  listJobPostings(status?: string): Promise<JobPosting[]> {
    const url = status ? `${this.base}/job-postings?status=${status}` : `${this.base}/job-postings`
    return firstValueFrom(this.http.get<JobPosting[]>(url))
  }

  /**
   * Creates a new job posting.
   *
   * @param data - posting title, department, description, and optional requirements
   * @returns the created posting
   */
  createJobPosting(data: CreateJobPostingDto): Promise<JobPosting> {
    return firstValueFrom(
      this.http.post<JobPosting>(`${this.base}/job-postings`, {
        title:         data.title,
        department_id: data.departmentId,
        description:   data.description,
        requirements:  data.requirements,
      }),
    )
  }

  /**
   * Fetches all candidates for a job posting.
   *
   * @param postingId - identifier of the posting whose candidates are fetched
   * @returns the candidate list
   */
  listCandidates(postingId: string): Promise<Candidate[]> {
    return firstValueFrom(
      this.http.get<Candidate[]>(`${this.base}/job-postings/${postingId}/candidates`),
    )
  }

  /**
   * Fetches a single candidate by identifier.
   *
   * @param id - identifier of the candidate to fetch
   * @returns the matching candidate
   */
  getCandidate(id: string): Promise<Candidate> {
    return firstValueFrom(this.http.get<Candidate>(`${this.base}/candidates/${id}`))
  }

  /**
   * Registers a new candidate application.
   *
   * @param data - posting id and candidate contact information
   * @returns the created candidate with status APPLIED
   */
  createCandidate(data: CreateCandidateDto): Promise<Candidate> {
    return firstValueFrom(
      this.http.post<Candidate>(`${this.base}/candidates`, {
        posting_id: data.postingId,
        full_name:  data.fullName,
        email:      data.email,
        phone:      data.phone,
        resume_url: data.resumeUrl,
      }),
    )
  }

  /**
   * Advances or rejects a candidate's pipeline status.
   *
   * @param id - identifier of the candidate to update
   * @param status - the desired next pipeline status
   * @returns the updated candidate record
   */
  advanceCandidateStatus(id: string, status: CandidateStatus): Promise<Candidate> {
    return firstValueFrom(
      this.http.patch<Candidate>(`${this.base}/candidates/${id}/status`, { status }),
    )
  }

  /**
   * Executes the hire transaction for a candidate in OFFER status.
   *
   * @param candidateId - identifier of the candidate to hire
   * @param data - onboarding data for the new employee
   * @returns the updated candidate and the new employee's id
   */
  hireCandidate(candidateId: string, data: HireDto): Promise<HireResult> {
    return firstValueFrom(
      this.http.post<HireResult>(`${this.base}/candidates/${candidateId}/hire`, {
        hire_date:       data.hireDate,
        salary:          data.salary,
        department_id:   data.departmentId,
        job_title:       data.jobTitle,
        corporate_email: data.corporateEmail,
        document_id:     data.documentId,
      }),
    )
  }
}
