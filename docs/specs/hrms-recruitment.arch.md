# Architecture Decision: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación que dispara alta de empleado
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Fecha**: 2026-06-19
**Modo**: Detección — proyecto existente
**Patrón arquitectónico**: Hexagonal (Ports & Adapters) — monorepo con Bun workspaces

---

## Patrón detectado

### Descripción

El proyecto usa Hexagonal Architecture con tres capas físicas separadas en packages:

```
packages/core           ← hexágono puro (dominio + contratos + casos de uso)
packages/boundary-postgres  ← adaptador de persistencia
packages/api            ← adaptador HTTP (Hono)
apps/hrms-ui            ← adaptador de presentación (Angular)
```

El core no importa nada de fuera de sí mismo. Los adaptadores importan del core. Nunca al revés.

### Regla de dependencias

```
boundary-postgres ──→ @hrms/core (implementa IRecruitmentRepository)
api               ──→ @hrms/core (usa use cases, tipos)
hrms-ui           ──→ API HTTP (consume endpoints REST)
```

---

## Mapeo del feature a la arquitectura

| Elemento del spec | Capa | Archivo | Responsabilidad |
|---|---|---|---|
| `JobPosting`, `Candidate` (estado) | dominio | `core/src/domain/candidate.ts` | Tipos + máquina de transiciones |
| `IRecruitmentRepository` | contratos (puerto) | `core/src/contracts/recruitment.ts` | Puerto de salida hacia persistencia |
| `ListJobPostingsUseCase` | aplicación | `core/src/usecases/list-job-postings.usecase.ts` | Lista vacantes con filtro opcional de status |
| `CreateJobPostingUseCase` | aplicación | `core/src/usecases/create-job-posting.usecase.ts` | Crea vacante, valida que el departamento exista |
| `UpdateJobPostingUseCase` | aplicación | `core/src/usecases/update-job-posting.usecase.ts` | Actualiza campos o cierra una vacante |
| `ListCandidatesUseCase` | aplicación | `core/src/usecases/list-candidates.usecase.ts` | Lista candidatos de una vacante |
| `CreateCandidateUseCase` | aplicación | `core/src/usecases/create-candidate.usecase.ts` | Crea candidato (APPLIED), valida unicidad email+posting |
| `AdvanceCandidateStatusUseCase` | aplicación | `core/src/usecases/advance-candidate-status.usecase.ts` | Valida transición y avanza/rechaza candidato |
| `HireCandidateUseCase` | aplicación | `core/src/usecases/hire-candidate.usecase.ts` | Valida OFFER, llama repo.hire() atómico |
| `RecruitmentRepository` | infraestructura | `boundary-postgres/src/repositories/recruitment.repository.ts` | Implementa IRecruitmentRepository con PostgreSQL |
| `RecruitmentController` | API | `api/src/controllers/recruitment.controller.ts` | Rutas HTTP + requirePermission(RECRUITMENT) |
| Módulo recruitment UI | presentación | `hrms-ui/src/app/recruitment/` | Componentes Angular + service + routes |

---

## Contratos entre capas

### Puerto: IRecruitmentRepository

```typescript
// core/src/contracts/recruitment.ts

export type CandidateStatus = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED'
export type PostingStatus   = 'OPEN' | 'CLOSED' | 'ON_HOLD'

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

export interface CandidateData {
  id: string
  postingId: string
  fullName: string
  email: string
  phone: string | null
  resumeUrl: string | null
  status: CandidateStatus
  notes: string | null
  hiredAsEmployeeId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateJobPostingInput {
  title: string
  departmentId: string
  description: string
  requirements?: string
}

export interface CreateCandidateInput {
  postingId: string
  fullName: string
  email: string
  phone?: string
  resumeUrl?: string
}

export interface HireInput {
  hireDate: string   // ISO date
  salary: number     // > 0
  departmentId: string
  jobTitle: string
  corporateEmail: string
  documentId: string
}

export interface HireResult {
  candidate: CandidateData
  employeeId: string
}

export interface IRecruitmentRepository {
  // Job postings
  listJobPostings(status?: PostingStatus): Promise<JobPostingData[]>
  findJobPostingById(id: string): Promise<JobPostingData | null>
  createJobPosting(input: CreateJobPostingInput): Promise<JobPostingData>
  updateJobPosting(id: string, patch: Partial<Omit<JobPostingData,'id'|'createdAt'>>): Promise<JobPostingData>

  // Candidates
  listCandidates(postingId: string): Promise<CandidateData[]>
  findCandidateById(id: string): Promise<CandidateData | null>
  createCandidate(input: CreateCandidateInput): Promise<CandidateData>
  existsCandidateByEmailAndPosting(email: string, postingId: string): Promise<boolean>
  updateCandidateStatus(id: string, status: CandidateStatus, notes?: string): Promise<CandidateData>

  // Atomic hire transaction
  hire(candidateId: string, input: HireInput): Promise<HireResult>
}
```

**Vive en**: `packages/core/src/contracts/recruitment.ts`
**Implementado por**: `packages/boundary-postgres/src/repositories/recruitment.repository.ts`

---

### Dominio: Candidate (máquina de estados)

```typescript
// core/src/domain/candidate.ts

export const CANDIDATE_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  APPLIED:   ['SCREENING', 'REJECTED'],
  SCREENING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER',     'REJECTED'],
  OFFER:     ['HIRED',     'REJECTED'],
  HIRED:     [],
  REJECTED:  [],
}

export class Candidate {
  constructor(private readonly data: CandidateData) {}

  get id()     { return this.data.id }
  get status() { return this.data.status }

  /** Throws ValidationError if next is not a valid transition from current status */
  assertCanTransitionTo(next: CandidateStatus): void { ... }

  /** Terminal states cannot be modified */
  isTerminal(): boolean { return this.status === 'HIRED' || this.status === 'REJECTED' }

  /** Only candidates in OFFER can be hired */
  assertReadyToHire(): void { ... }
}
```

---

## Decisión arquitectónica clave: transacción de `hire`

| # | Decisión | Motivo | Alternativa descartada |
|---|---|---|---|
| 1 | `IRecruitmentRepository.hire()` encapsula toda la transacción SQL | Mantiene los invariantes de atomicidad sin filtrar lógica de infraestructura (transacciones) al caso de uso. Patrón ya establecido en `EmployeeRepository.create()` que también maneja employee + onboarding en una transacción. | `HireCandidateUseCase` llama a `employeeRepo.create()` y `recruitmentRepo.updateStatus()` por separado → no atómico |
| 2 | El use case valida reglas de negocio ANTES de llamar a `hire()` | El use case sigue siendo el guardián de la lógica de dominio. El repo solo persiste. | Poner validaciones en el repo → mezcla de responsabilidades |
| 3 | `hire()` crea employee + user account + onboarding en un solo `sql.begin()` | Preserva el invariante 3 del spec: employee + onboarding en una sola transacción. El user account se crea dentro del mismo BEGIN/COMMIT. | Crear user account fuera de la transacción → riesgo de employee sin cuenta de acceso |
| 4 | `RecruitmentController` registra tanto `/job-postings` como `/candidates` | Ambas rutas comparten el mismo módulo de reclutamiento; un único controlador es coherente con el patrón existente (benefits, documents) | Dos controladores separados → sin ventaja práctica |

---

## Flujo de hire-candidate (end-to-end)

```
POST /candidates/:id/hire
  │
  ├─ RecruitmentController
  │   ├─ requirePermission(RECRUITMENT, canEdit)
  │   └─ parse + validate body → HireInput
  │
  ├─ HireCandidateUseCase.execute(candidateId, input)
  │   ├─ repo.findCandidateById(id) → Candidate domain object
  │   ├─ candidate.assertReadyToHire()        ← 422 si status != OFFER
  │   ├─ candidate.assertNotAlreadyHired()    ← 422 si hired_as_employee_id != null
  │   ├─ validate: salary > 0, email format, documentId not empty
  │   └─ repo.hire(id, input) → HireResult
  │
  └─ RecruitmentRepository.hire() [SQL transaction]
      ├─ BEGIN
      ├─ INSERT INTO employees (...) RETURNING id
      ├─ INSERT INTO onboarding_steps (5 rows)
      ├─ INSERT INTO users (corporateEmail, hash, roleId='employee', employeeId)
      ├─ UPDATE candidates SET status='HIRED', hired_as_employee_id=<new_id>
      └─ COMMIT → return { candidate, employeeId }
```

---

## Estructura del módulo UI

```
apps/hrms-ui/src/app/recruitment/
├── recruitment-page.component.ts           ← Smart: lista de vacantes
├── job-posting-detail-page.component.ts    ← Smart: candidatos de una vacante
├── candidate-profile-page.component.ts     ← Smart: perfil + stepper del pipeline
├── hire-form-page.component.ts             ← Smart: formulario de contratación (solo desde OFFER)
├── recruitment.service.ts                  ← Llama a /job-postings y /candidates
└── recruitment.routes.ts                   ← Lazy loading por ruta
```

Routing interno:
```
/recruitment                    → RecruitmentPageComponent
/recruitment/:postingId         → JobPostingDetailPageComponent
/recruitment/candidate/:id      → CandidateProfilePageComponent
/recruitment/candidate/:id/hire → HireFormPageComponent (guard: status == OFFER)
```

---

## Violaciones detectadas y corregidas

Ninguna. El diseño sigue el patrón hexagonal establecido.

---

## Lo que NO debe cruzar capas

- `CandidateData` y `JobPostingData` (DTOs) salen del repo y entran al use case y al controlador — la entidad de dominio `Candidate` no sale del use case
- El controlador no toma decisiones de transición de estado — solo pasa el nuevo status al use case
- `RecruitmentRepository.hire()` no valida reglas de negocio — solo ejecuta el SQL
- El controlador no importa tipos de `@hrms/boundary-postgres` directamente

---

## Próximo paso

Continuar con `/tdd-plan` para el plan de tests Red/Green/Refactor del backend, y `/tdd-plan-ui` para los componentes Angular.
