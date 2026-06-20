import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListJobPostingsUseCase } from '@hrms/core/usecases/list-job-postings.usecase'
import type { CreateJobPostingUseCase } from '@hrms/core/usecases/create-job-posting.usecase'
import type { UpdateJobPostingUseCase } from '@hrms/core/usecases/update-job-posting.usecase'
import type { ListCandidatesUseCase } from '@hrms/core/usecases/list-candidates.usecase'
import type { GetCandidateUseCase } from '@hrms/core/usecases/get-candidate.usecase'
import type { CreateCandidateUseCase } from '@hrms/core/usecases/create-candidate.usecase'
import type { AdvanceCandidateStatusUseCase } from '@hrms/core/usecases/advance-candidate-status.usecase'
import type { HireCandidateUseCase } from '@hrms/core/usecases/hire-candidate.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'

const POSTING_STATUSES = ['OPEN', 'CLOSED', 'ON_HOLD'] as const
const CANDIDATE_STATUSES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const

const createPostingSchema = z.object({
  title:        z.string().min(1).max(255),
  department_id: z.string().uuid(),
  description:  z.string().min(1),
  requirements: z.string().optional(),
})

const updatePostingSchema = z.object({
  title:        z.string().min(1).max(255).optional(),
  description:  z.string().min(1).optional(),
  requirements: z.string().optional(),
  status:       z.enum(POSTING_STATUSES).optional(),
})

const createCandidateSchema = z.object({
  posting_id: z.string().uuid(),
  full_name:  z.string().min(1).max(255),
  email:      z.string().email(),
  phone:      z.string().max(50).optional(),
  resume_url: z.string().url().optional(),
})

const advanceStatusSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES),
  notes:  z.string().optional(),
})

const hireSchema = z.object({
  hire_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  salary:          z.number().positive(),
  department_id:   z.string().uuid(),
  job_title:       z.string().min(1).max(255),
  corporate_email: z.string().email(),
  document_id:     z.string().min(1).max(100),
})

function handleError(c: any, err: unknown) {
  if (err instanceof ForbiddenError)  return c.json({ error: err.message }, 403)
  if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
  if (err instanceof ConflictError)   return c.json({ error: err.message }, 409)
  if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
  throw err
}

/**
 * Builds the recruitment router, wiring HTTP routes to atomic use cases.
 *
 * @param listJobPostings - use case that returns all job postings
 * @param createJobPosting - use case that creates a new posting
 * @param updateJobPosting - use case that updates an existing posting
 * @param listCandidates - use case that returns candidates for a posting
 * @param getCandidate - use case that returns a single candidate by id
 * @param createCandidate - use case that registers a new candidate
 * @param advanceCandidateStatus - use case that transitions a candidate's pipeline status
 * @param hireCandidate - use case that executes the atomic hire transaction
 * @returns two Hono sub-routers: jobPostingRoutes and candidateRoutes
 */
export function createRecruitmentController(
  listJobPostings:        ListJobPostingsUseCase,
  createJobPosting:       CreateJobPostingUseCase,
  updateJobPosting:       UpdateJobPostingUseCase,
  listCandidates:         ListCandidatesUseCase,
  getCandidate:           GetCandidateUseCase,
  createCandidate:        CreateCandidateUseCase,
  advanceCandidateStatus: AdvanceCandidateStatusUseCase,
  hireCandidate:          HireCandidateUseCase,
) {
  const postings = new Hono()
  postings.use('*', authMiddleware)

  // GET /job-postings?status=OPEN — canView
  postings.get('/', requirePermission(AppModule.RECRUITMENT, 'canView'), async c => {
    const status = c.req.query('status') as any
    return c.json(await listJobPostings.execute({ status }))
  })

  // POST /job-postings — canCreate
  postings.post(
    '/',
    requirePermission(AppModule.RECRUITMENT, 'canCreate'),
    zValidator('json', createPostingSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const posting = await createJobPosting.execute({
          title:        body.title,
          departmentId: body.department_id,
          description:  body.description,
          requirements: body.requirements,
        })
        return c.json(posting, 201)
      } catch (err) { return handleError(c, err) }
    },
  )

  // PATCH /job-postings/:id — canEdit
  postings.patch(
    '/:id',
    requirePermission(AppModule.RECRUITMENT, 'canEdit'),
    zValidator('json', updatePostingSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const posting = await updateJobPosting.execute(c.req.param('id'), body)
        return c.json(posting)
      } catch (err) { return handleError(c, err) }
    },
  )

  // GET /job-postings/:id/candidates — canView
  postings.get(
    '/:id/candidates',
    requirePermission(AppModule.RECRUITMENT, 'canView'),
    async c => {
      try {
        const candidates = await listCandidates.execute({ postingId: c.req.param('id') })
        return c.json(candidates)
      } catch (err) { return handleError(c, err) }
    },
  )

  const candidates = new Hono()
  candidates.use('*', authMiddleware)

  // GET /candidates/:id — canView
  candidates.get(
    '/:id',
    requirePermission(AppModule.RECRUITMENT, 'canView'),
    async c => {
      try {
        const candidate = await getCandidate.execute(c.req.param('id'))
        return c.json(candidate)
      } catch (err) { return handleError(c, err) }
    },
  )

  // POST /candidates — canCreate
  candidates.post(
    '/',
    requirePermission(AppModule.RECRUITMENT, 'canCreate'),
    zValidator('json', createCandidateSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const candidate = await createCandidate.execute({
          postingId:  body.posting_id,
          fullName:   body.full_name,
          email:      body.email,
          phone:      body.phone,
          resumeUrl:  body.resume_url,
        })
        return c.json(candidate, 201)
      } catch (err) { return handleError(c, err) }
    },
  )

  // PATCH /candidates/:id/status — canEdit
  candidates.patch(
    '/:id/status',
    requirePermission(AppModule.RECRUITMENT, 'canEdit'),
    zValidator('json', advanceStatusSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const candidate = await advanceCandidateStatus.execute({
          candidateId: c.req.param('id'),
          status:      body.status,
          notes:       body.notes,
        })
        return c.json(candidate)
      } catch (err) { return handleError(c, err) }
    },
  )

  // POST /candidates/:id/hire — canEdit
  candidates.post(
    '/:id/hire',
    requirePermission(AppModule.RECRUITMENT, 'canEdit'),
    zValidator('json', hireSchema),
    async c => {
      try {
        const body = c.req.valid('json')
        const result = await hireCandidate.execute({
          candidateId:    c.req.param('id'),
          hireDate:       body.hire_date,
          salary:         body.salary,
          departmentId:   body.department_id,
          jobTitle:       body.job_title,
          corporateEmail: body.corporate_email,
          documentId:     body.document_id,
        })
        return c.json(result, 201)
      } catch (err) { return handleError(c, err) }
    },
  )

  return { jobPostingRoutes: postings, candidateRoutes: candidates }
}
