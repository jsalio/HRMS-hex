import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { ListDocumentsUseCase } from '@hrms/core/usecases/list-documents.usecase'
import type { GetDocumentUseCase } from '@hrms/core/usecases/get-document.usecase'
import type { CreateDocumentUseCase } from '@hrms/core/usecases/create-document.usecase'
import type { SignDocumentUseCase } from '@hrms/core/usecases/sign-document.usecase'
import type { ArchiveDocumentUseCase } from '@hrms/core/usecases/archive-document.usecase'
import type { RenewDocumentUseCase } from '@hrms/core/usecases/renew-document.usecase'
import type { ListExpiringDocumentsUseCase } from '@hrms/core/usecases/list-expiring-documents.usecase'
import { AppModule } from '@hrms/core/contracts/roles'
import { NotFoundError, ValidationError } from '@hrms/core'
import { authMiddleware } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { toDocumentDTO, toExpiringDocumentDTO } from '../mappers/document.mapper'
import type { AuthenticatedUser } from '@hrms/core/contracts/auth'

const DOCUMENT_TYPE   = z.enum(['contract', 'nda', 'policy', 'certificate', 'other'])
const DOCUMENT_STATUS = z.enum(['PENDING', 'SIGNED', 'ARCHIVED'])

const createDocumentSchema = z.object({
  name:       z.string().min(1).max(255),
  type:       DOCUMENT_TYPE,
  fileUrl:    z.string().url(),
  templateId: z.string().uuid().nullable().optional(),
  expiresAt:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const signDocumentSchema = z.object({
  fileHash: z.string().length(64, 'SHA-256 hash must be exactly 64 hex characters'),
})

const renewDocumentSchema = z.object({
  fileUrl:   z.string().url(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

/**
 * Builds the document routers, wiring each HTTP route to its atomic use case.
 *
 * @param listDocuments - use case that lists an employee's documents
 * @param getDocument - use case that retrieves a single document
 * @param createDocument - use case that creates a document for an employee
 * @param signDocument - use case that records a signature on a document
 * @param archiveDocument - use case that archives a document
 * @param renewDocument - use case that renews a document
 * @param listExpiringDocuments - use case that lists documents nearing expiry
 * @returns the employee-scoped and document-scoped Hono routers, both protected
 *          by authentication and DOCUMENTS permissions
 */
export function createDocumentsController(
  listDocuments: ListDocumentsUseCase,
  getDocument: GetDocumentUseCase,
  createDocument: CreateDocumentUseCase,
  signDocument: SignDocumentUseCase,
  archiveDocument: ArchiveDocumentUseCase,
  renewDocument: RenewDocumentUseCase,
  listExpiringDocuments: ListExpiringDocumentsUseCase,
) {
  // Routes mounted at /employees prefix
  const employeeRoutes = new Hono()
  employeeRoutes.use('*', authMiddleware)
  employeeRoutes.use('*', requirePermission(AppModule.DOCUMENTS, 'canView'))

  // GET /employees/:employeeId/documents
  employeeRoutes.get('/:employeeId/documents', async (c) => {
    const { employeeId } = c.req.param()
    const q = c.req.query()
    const statusParsed = DOCUMENT_STATUS.optional().safeParse(q.status)
    const typeParsed   = DOCUMENT_TYPE.optional().safeParse(q.type)
    const docs = await listDocuments.execute(employeeId, {
      status: statusParsed.success ? statusParsed.data : undefined,
      type:   typeParsed.success   ? typeParsed.data   : undefined,
    })
    return c.json(docs.map(toDocumentDTO))
  })

  // POST /employees/:employeeId/documents
  employeeRoutes.post(
    '/:employeeId/documents',
    requirePermission(AppModule.DOCUMENTS, 'canCreate'),
    zValidator('json', createDocumentSchema),
    async (c) => {
      const { employeeId } = c.req.param()
      const body = c.req.valid('json')
      try {
        const doc = await createDocument.execute({ ...body, employeeId })
        return c.json(toDocumentDTO(doc), 201)
      } catch (err) {
        if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
        if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
        throw err
      }
    },
  )

  // Routes mounted at /documents prefix
  const documentRoutes = new Hono()
  documentRoutes.use('*', authMiddleware)
  documentRoutes.use('*', requirePermission(AppModule.DOCUMENTS, 'canView'))

  // GET /documents/expiring?days=30  — must precede /:id
  documentRoutes.get('/expiring', async (c) => {
    const raw  = Number(c.req.query('days') ?? 30)
    const days = isNaN(raw) ? 30 : Math.min(raw, 365)
    const docs = await listExpiringDocuments.execute(days)
    return c.json(docs.map(toExpiringDocumentDTO))
  })

  // GET /documents/:id
  documentRoutes.get('/:id', async (c) => {
    try {
      const doc = await getDocument.execute(c.req.param('id'))
      return c.json(toDocumentDTO(doc))
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
      throw err
    }
  })

  // POST /documents/:id/sign
  documentRoutes.post(
    '/:id/sign',
    requirePermission(AppModule.DOCUMENTS, 'canEdit'),
    zValidator('json', signDocumentSchema),
    async (c) => {
      const user = c.get('user') as AuthenticatedUser
      const { fileHash } = c.req.valid('json')
      try {
        const doc = await signDocument.execute(c.req.param('id'), fileHash, user.id)
        return c.json(toDocumentDTO(doc))
      } catch (err) {
        if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
        if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
        throw err
      }
    },
  )

  // POST /documents/:id/archive
  documentRoutes.post(
    '/:id/archive',
    requirePermission(AppModule.DOCUMENTS, 'canEdit'),
    async (c) => {
      try {
        const doc = await archiveDocument.execute(c.req.param('id'))
        return c.json(toDocumentDTO(doc))
      } catch (err) {
        if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404)
        if (err instanceof ValidationError) return c.json({ error: err.message }, 422)
        throw err
      }
    },
  )

  // POST /documents/:id/renew
  documentRoutes.post(
    '/:id/renew',
    requirePermission(AppModule.DOCUMENTS, 'canCreate'),
    zValidator('json', renewDocumentSchema),
    async (c) => {
      const body = c.req.valid('json')
      try {
        const doc = await renewDocument.execute(c.req.param('id'), body)
        return c.json(toDocumentDTO(doc), 201)
      } catch (err) {
        if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
        throw err
      }
    },
  )

  return { employeeRoutes, documentRoutes }
}
