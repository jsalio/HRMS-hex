import { describe, it, expect, mock } from 'bun:test'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-x'

import { Hono } from 'hono'
import { createRecruitmentController } from '../controllers/recruitment.controller'
import type { ListJobPostingsUseCase } from '@hrms/core/usecases/list-job-postings.usecase'
import type { CreateJobPostingUseCase } from '@hrms/core/usecases/create-job-posting.usecase'
import type { UpdateJobPostingUseCase } from '@hrms/core/usecases/update-job-posting.usecase'
import type { ListCandidatesUseCase } from '@hrms/core/usecases/list-candidates.usecase'
import type { GetCandidateUseCase } from '@hrms/core/usecases/get-candidate.usecase'
import type { CreateCandidateUseCase } from '@hrms/core/usecases/create-candidate.usecase'
import type { AdvanceCandidateStatusUseCase } from '@hrms/core/usecases/advance-candidate-status.usecase'
import type { HireCandidateUseCase } from '@hrms/core/usecases/hire-candidate.usecase'
import { AppModule, ValidationError, ConflictError, NotFoundError } from '@hrms/core'
import type { JobPostingData, CandidateData, HireResult } from '@hrms/core'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode('test-secret-at-least-32-characters-x')

async function makeToken(
  sub: string,
  roleName: string,
  permissions: Array<{ module: AppModule; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean }>,
) {
  return new SignJWT({ sub, email: `${sub}@hrms.com`, role: { id: 'r1', name: roleName, permissions } })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret)
}

const allPerms = Object.values(AppModule).map(m => ({
  module: m, canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true,
}))

const noPerms = Object.values(AppModule).map(m => ({
  module: m, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false,
}))

const postingData: JobPostingData = {
  id: 'p-1', title: 'Dev Senior', departmentId: 'd-1',
  description: 'We need a senior dev.', requirements: null,
  status: 'OPEN', createdAt: new Date(), closedAt: null,
}

const candidateData: CandidateData = {
  id: 'c-1', postingId: 'p-1', fullName: 'Ana García',
  email: 'ana@test.com', phone: null, resumeUrl: null,
  status: 'APPLIED', notes: null, hiredAsEmployeeId: null,
  createdAt: new Date(), updatedAt: new Date(),
}

const hireResult: HireResult = {
  candidate: { ...candidateData, status: 'HIRED', hiredAsEmployeeId: 'emp-1' },
  employeeId: 'emp-1',
}

const DEPT_UUID = '00000000-0000-0000-0000-000000000001'

interface UCOverrides {
  listJobPostings?:        () => Promise<unknown>
  createJobPosting?:       () => Promise<unknown>
  updateJobPosting?:       () => Promise<unknown>
  listCandidates?:         () => Promise<unknown>
  getCandidate?:           () => Promise<unknown>
  createCandidate?:        () => Promise<unknown>
  advanceCandidateStatus?: () => Promise<unknown>
  hireCandidate?:          () => Promise<unknown>
}

function buildApp(overrides: UCOverrides = {}) {
  const listJobPostings        = { execute: overrides.listJobPostings        ?? mock(() => Promise.resolve([postingData])) } as unknown as ListJobPostingsUseCase
  const createJobPosting       = { execute: overrides.createJobPosting       ?? mock(() => Promise.resolve(postingData))  } as unknown as CreateJobPostingUseCase
  const updateJobPosting       = { execute: overrides.updateJobPosting       ?? mock(() => Promise.resolve(postingData))  } as unknown as UpdateJobPostingUseCase
  const listCandidates         = { execute: overrides.listCandidates         ?? mock(() => Promise.resolve([candidateData])) } as unknown as ListCandidatesUseCase
  const getCandidate           = { execute: overrides.getCandidate           ?? mock(() => Promise.resolve(candidateData)) } as unknown as GetCandidateUseCase
  const createCandidate        = { execute: overrides.createCandidate        ?? mock(() => Promise.resolve(candidateData)) } as unknown as CreateCandidateUseCase
  const advanceCandidateStatus = { execute: overrides.advanceCandidateStatus ?? mock(() => Promise.resolve({ ...candidateData, status: 'SCREENING' })) } as unknown as AdvanceCandidateStatusUseCase
  const hireCandidate          = { execute: overrides.hireCandidate          ?? mock(() => Promise.resolve(hireResult))   } as unknown as HireCandidateUseCase

  const ctrl = createRecruitmentController(
    listJobPostings, createJobPosting, updateJobPosting,
    listCandidates, getCandidate, createCandidate,
    advanceCandidateStatus, hireCandidate,
  )
  const app = new Hono()
  app.route('/job-postings', ctrl.jobPostingRoutes)
  app.route('/candidates',   ctrl.candidateRoutes)
  return app
}

const validPostingBody = JSON.stringify({ title: 'Dev Senior', department_id: DEPT_UUID, description: 'We need you.' })
const validCandidateBody = JSON.stringify({ posting_id: DEPT_UUID, full_name: 'Ana García', email: 'ana@test.com' })
const validHireBody = JSON.stringify({
  hire_date: '2026-06-19', salary: 50000, department_id: DEPT_UUID,
  job_title: 'Senior Dev', corporate_email: 'ana@company.com', document_id: 'DOC-001',
})

describe('RecruitmentController — /job-postings', () => {
  // Test 3.1
  it('given_no_auth_token_when_GET_job_postings_then_returns_401', async () => {
    const res = await buildApp().request('/job-postings')
    expect(res.status).toBe(401)
  })

  // Test 3.2
  it('given_no_recruitment_canView_when_GET_job_postings_then_returns_403', async () => {
    const token = await makeToken('u-1', 'employee', noPerms)
    const res = await buildApp().request('/job-postings', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
  })

  // Test 3.3
  it('given_recruitment_canView_when_GET_job_postings_then_returns_200_with_array', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/job-postings', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
  })

  // Test 3.4
  it('given_valid_body_and_canCreate_when_POST_job_postings_then_returns_201', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/job-postings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: validPostingBody,
    })
    expect(res.status).toBe(201)
  })

  // Test 3.5
  it('given_missing_title_when_POST_job_postings_then_returns_400', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/job-postings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_id: DEPT_UUID, description: 'Desc' }),
    })
    expect(res.status).toBe(400)
  })

  // Test 3.6
  it('given_canView_when_GET_candidates_for_posting_then_returns_200', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/job-postings/p-1/candidates', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
  })
})

describe('RecruitmentController — /candidates', () => {
  // Test 3.7
  it('given_valid_body_and_canCreate_when_POST_candidates_then_returns_201_with_APPLIED_status', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/candidates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: validCandidateBody,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as CandidateData
    expect(body.status).toBe('APPLIED')
  })

  // Test 3.8
  it('given_ConflictError_when_POST_candidates_then_returns_409', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp({
      createCandidate: () => Promise.reject(new ConflictError('duplicate')),
    }).request('/candidates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: validCandidateBody,
    })
    expect(res.status).toBe(409)
  })

  // Test 3.9
  it('given_valid_transition_and_canEdit_when_PATCH_candidate_status_then_returns_200', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/candidates/c-1/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SCREENING' }),
    })
    expect(res.status).toBe(200)
  })

  // Test 3.10
  it('given_ValidationError_on_invalid_transition_when_PATCH_status_then_returns_422', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp({
      advanceCandidateStatus: () => Promise.reject(new ValidationError('invalid transition')),
    }).request('/candidates/c-1/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'HIRED' }),
    })
    expect(res.status).toBe(422)
  })

  // Test 3.11
  it('given_OFFER_candidate_and_canEdit_when_POST_hire_then_returns_201_with_candidate_and_employeeId', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp().request('/candidates/c-1/hire', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: validHireBody,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as HireResult
    expect(body.employeeId).toBe('emp-1')
    expect(body.candidate).toBeDefined()
  })

  // Test 3.12
  it('given_ValidationError_when_POST_hire_then_returns_422', async () => {
    const token = await makeToken('u-1', 'hr_manager', allPerms)
    const res = await buildApp({
      hireCandidate: () => Promise.reject(new ValidationError('not in OFFER status')),
    }).request('/candidates/c-1/hire', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: validHireBody,
    })
    expect(res.status).toBe(422)
  })
})
