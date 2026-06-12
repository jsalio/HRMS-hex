# SDD Spec: hrms-recruitment

**Feature**: Pipeline de reclutamiento — candidatos, oferta y contratación que dispara alta de empleado
**User story**: Como HR Manager quiero gestionar vacantes y candidatos hasta su contratación, momento en que se crea automáticamente el expediente del empleado y se inicia su onboarding
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 8 de 10
**Dependencias**: hrms-employees completo

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Pipeline candidato | APPLIED → SCREENING → INTERVIEW → OFFER → HIRED \| REJECTED |
| Contratación | Crea employee + dispara onboarding en la misma transacción |
| Candidato contratado | hired_as_employee_id != NULL; solo puede contratarse una vez |
| Rama Git | `feat/hrms-recruitment` (parte desde main después de merge de hrms-employees) |

---

## Modelo de datos

```sql
CREATE TABLE job_postings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  description   TEXT NOT NULL,
  requirements  TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','CLOSED','ON_HOLD')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE TABLE candidates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id           UUID NOT NULL REFERENCES job_postings(id),
  full_name            VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  phone                VARCHAR(50),
  resume_url           TEXT,
  status               VARCHAR(30) NOT NULL DEFAULT 'APPLIED'
                       CHECK (status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED')),
  notes                TEXT,
  hired_as_employee_id UUID REFERENCES employees(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hired_has_employee
    CHECK (status != 'HIRED' OR hired_as_employee_id IS NOT NULL)
);
```

### Transiciones válidas del pipeline
```
APPLIED     → SCREENING | REJECTED
SCREENING   → INTERVIEW | REJECTED
INTERVIEW   → OFFER     | REJECTED
OFFER       → HIRED     | REJECTED
HIRED       → (terminal)
REJECTED    → (terminal)
```

---

## Contratos de API

**GET /job-postings** — `?status` → `JobPosting[]`

**POST /job-postings** — Body: `{title, department_id, description, requirements?}` → `201`

**PATCH /job-postings/:id** — Body: partial → `200`

**GET /job-postings/:id/candidates** — `Candidate[]`

**POST /candidates**
```
Body: { posting_id, full_name, email, phone?, resume_url? }
Response 201: Candidate (status=APPLIED)
```

**PATCH /candidates/:id/status**
```
Body: { status: string, notes?: string }
Response 200: Candidate
Efecto: avanza pipeline según transiciones válidas
Errores: 422 transición inválida | 422 status terminal (HIRED/REJECTED)
```

**POST /candidates/:id/hire**
```
Body: { hire_date, salary, department_id, job_title, corporate_email, document_id }
Response 201: { candidate: Candidate, employee: Employee }
Efecto: crea employee + onboarding (transacción), status→HIRED, sets hired_as_employee_id
Errores: 422 ya contratado | 409 document_id/email duplicado en employees
```

---

## Máquina de estados del frontend

```
POSTINGS_LIST
  → [+ vacante]        → POSTING_FORM
  → [ver candidatos]   → CANDIDATES_LIST (filtrado por vacante)

CANDIDATES_LIST
  → [+ candidato]      → CANDIDATE_FORM
  → [ver perfil]       → CANDIDATE_PROFILE

CANDIDATE_PROFILE
  → pipeline visual (stepper)
  → [avanzar/rechazar] → STATUS_MODAL → perfil actualizado
  → [contratar]        → HIRE_FORM (solo desde OFFER)
    → [confirmar]      → redirect a EMPLOYEE_DETAIL del nuevo empleado
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | Solo transiciones válidas del pipeline — cualquier otra retorna 422 |
| 2 | Un candidato HIRED no puede cambiar de status |
| 3 | Al contratar, employee + onboarding se crean en una sola transacción |
| 4 | hired_as_employee_id es único — no se puede crear dos empleados del mismo candidato |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/recruitment.ts` | NUEVO |
| `packages/core/src/domain/candidate.ts` | NUEVO — con máquina de transiciones |
| `packages/core/src/usecases/hire-candidate.usecase.ts` | NUEVO — coordina con create-employee |
| `packages/boundary-postgres/migrations/008_recruitment.sql` | NUEVO |
| `packages/api/src/controllers/recruitment.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/recruitment/` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves recruitment.* |

---

## Fuera de scope

- Portal público de postulación (v2)
- Programación automática de entrevistas
- Evaluaciones técnicas / pruebas (evaluaciones fuera de scope v1)
- Integración con LinkedIn/portales de empleo
