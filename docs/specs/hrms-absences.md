# hrms-absences — Solicitudes de Ausencia

**Fecha**: 2026-06-13
**Estado**: Implementado
**Sub-spec**: 4 de 10 — hrms-hex
**Dependencias**: hrms-auth-roles, hrms-employees completos

---

## Qué es este feature

Gestión del ciclo completo de solicitudes de ausencia: el empleado solicita días libres, el sistema verifica el balance disponible, HR aprueba o rechaza, y el balance se actualiza automáticamente.

Cada tipo de ausencia (vacaciones, enfermedad, permiso personal, etc.) tiene un balance anual por empleado. Al solicitar, los días se reservan en `pending_days`. Al aprobar, pasan a `used_days`. Al rechazar o cancelar, se liberan.

---

## Qué se construyó

### Modelo de datos

```sql
CREATE TABLE absence_types (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(100) NOT NULL UNIQUE,
  annual_allowance_days INT NOT NULL,
  requires_approval    BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE absence_balances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id),
  absence_type_id  UUID NOT NULL REFERENCES absence_types(id),
  year             INT NOT NULL,
  allocated_days   INT NOT NULL,
  used_days        INT NOT NULL DEFAULT 0,
  pending_days     INT NOT NULL DEFAULT 0,
  UNIQUE(employee_id, absence_type_id, year)
);

CREATE TABLE absence_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id),
  absence_type_id  UUID NOT NULL REFERENCES absence_types(id),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  working_days     INT NOT NULL,
  reason           TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by      UUID REFERENCES users(id),
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Contratos de API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/absence-types` | canView | Catálogo de tipos de ausencia |
| GET | `/employees/:id/absence-balances?year` | canView | Balances de un empleado para un año |
| GET | `/absence-requests` | canView | Lista con filtros (employee_id, status, from, to, page, limit) |
| POST | `/absence-requests` | canCreate | Crea solicitud PENDING y reserva días |
| PATCH | `/absence-requests/:id/approve` | canEdit (hr_manager/super_admin) | PENDING → APPROVED; pending→used |
| PATCH | `/absence-requests/:id/reject` | canEdit (hr_manager/super_admin) | PENDING → REJECTED; libera reserva |
| PATCH | `/absence-requests/:id/cancel` | canCreate (propietario) | PENDING → CANCELLED; libera reserva |

**POST /absence-requests** body: `{ employee_id, absence_type_id, start_date, end_date, reason? }`
**PATCH /approve** body: `{ review_notes? }`
**PATCH /reject** body: `{ review_notes }` (obligatorio)

**Errores**: 404 NotFoundError (empleado/tipo), 422 ValidationError (inactivo, sin días hábiles, solapamiento, balance insuficiente, no propietario en cancelación), 409 ConflictError (solapamiento)

### Invariantes del sistema

1. `used_days + pending_days <= allocated_days` — enforceado por `AbsenceBalance.assertHasSufficientBalance()` antes de crear la solicitud
2. Solo el propietario puede cancelar su solicitud PENDING
3. Solo HR / super_admin pueden aprobar o rechazar
4. Días hábiles = lunes a viernes (festivos: v2)
5. Un empleado INACTIVE no puede solicitar ausencias

---

## Cómo está estructurado el código

### Patrón arquitectónico

Hexagonal idéntico a los sub-specs anteriores. Los contratos usan composición de capacidades atómicas (ADR-0001): cada use case declara solo las interfaces que necesita del repositorio.

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/absences.ts` | contratos | 12 capacidades atómicas + contratos compuestos por use case + puerto completo `IAbsenceRepository` |
| `packages/core/src/domain/absence-balance.ts` | dominio | Clase `AbsenceBalance` con `assertHasSufficientBalance`; guards `assertCanApprove`, `assertCanReject`, `assertCanCancel`; función pura `calculateWorkingDays` |
| `packages/core/src/usecases/request-absence.usecase.ts` | aplicación | `RequestAbsenceUseCase` — valida empleado, tipo, fechas, solapamientos y balance; crea solicitud y reserva días |
| `packages/core/src/usecases/approve-absence.usecase.ts` | aplicación | `ApproveAbsenceUseCase` — convierte `pending_days` en `used_days` y marca APPROVED |
| `packages/core/src/usecases/reject-absence.usecase.ts` | aplicación | `RejectAbsenceUseCase` — libera la reserva y marca REJECTED |
| `packages/core/src/usecases/cancel-absence.usecase.ts` | aplicación | `CancelAbsenceUseCase` — verifica propiedad, libera reserva y marca CANCELLED |
| `packages/core/src/usecases/list-absence-requests.usecase.ts` | aplicación | `ListAbsenceRequestsUseCase` — listado paginado con filtros |
| `packages/core/src/usecases/list-absence-balances.usecase.ts` | aplicación | `ListAbsenceBalancesUseCase` — balances de un empleado por año |
| `packages/core/src/usecases/list-absence-types.usecase.ts` | aplicación | `ListAbsenceTypesUseCase` — catálogo completo |
| `packages/boundary-postgres/src/migrations/004_absences.sql` | infra | Tablas absence_types, absence_balances, absence_requests + seed |
| `packages/boundary-postgres/src/repositories/absence.repository.ts` | infra | `AbsenceRepository` implementando `IAbsenceRepository` (12 métodos) |
| `packages/api/src/controllers/absences.controller.ts` | API | `createAbsencesController` — 7 rutas |
| `apps/hrms-ui/src/app/absences/absences.service.ts` | UI | `AbsencesService`: list, balances, request, approve, reject, cancel |
| `apps/hrms-ui/src/app/absences/my-absences-page.component.ts` | UI | Vista de empleado — solicitar y cancelar |
| `apps/hrms-ui/src/app/absences/approvals-page.component.ts` | UI | Vista HR — aprobar/rechazar solicitudes pendientes |
| `apps/hrms-ui/src/assets/i18n/es.json` | UI | Claves `absences.*` |
| `apps/hrms-ui/src/assets/i18n/en.json` | UI | Claves `absences.*` |
| `apps/hrms-ui/src/assets/i18n/pt.json` | UI | Claves `absences.*` |

---

## Cómo se verifica

### Tests de dominio (`packages/core-tests/src/domain/absence-balance.test.ts`)

| Test | Qué verifica |
|---|---|
| `AbsenceBalance: has sufficient balance` | `assertHasSufficientBalance` no lanza cuando hay días disponibles |
| `AbsenceBalance: throws ValidationError when balance insufficient` | `assertHasSufficientBalance` lanza cuando `available < requested` |
| `AbsenceBalance: availableDays = allocated - used - pending` | cálculo correcto de disponibles |
| `assertCanApprove: passes when PENDING` | happy path approve |
| `assertCanApprove: throws when APPROVED` | transición inválida |
| `assertCanApprove: throws when CANCELLED` | transición inválida |
| `assertCanCancel: passes when PENDING and owner` | happy path cancel |
| `assertCanCancel: throws when different employee` | no propietario |
| `assertCanCancel: throws when non-PENDING` | estado inválido para cancelar |
| `calculateWorkingDays: counts only Monday-Friday` | días hábiles sin fines de semana |

### Tests de use cases (`packages/core-tests/src/usecases/`)

| Test | Use case | Qué verifica |
|---|---|---|
| `creates_PENDING_request_and_reserves_balance_for_active_employee` | RequestAbsenceUseCase | happy path |
| `throws_NotFoundError_when_employee_not_found` | RequestAbsenceUseCase | empleado inexistente |
| `throws_ValidationError_when_employee_is_INACTIVE` | RequestAbsenceUseCase | empleado inactivo |
| `throws_ValidationError_when_balance_insufficient` | RequestAbsenceUseCase | balance insuficiente |
| `throws_ValidationError_when_dates_overlap_existing_request` | RequestAbsenceUseCase | solapamiento de fechas |
| `moves_pending_days_to_used_and_sets_APPROVED` | ApproveAbsenceUseCase | happy path |
| `throws_ValidationError_when_request_is_not_PENDING` | ApproveAbsenceUseCase | transición inválida |
| `releases_pending_days_and_sets_REJECTED` | RejectAbsenceUseCase | happy path |
| `releases_pending_days_and_sets_CANCELLED` | CancelAbsenceUseCase | happy path |
| `throws_ValidationError_when_requesting_employee_is_not_owner` | CancelAbsenceUseCase | no propietario |

> **Cobertura parcial**: `ListAbsenceRequestsUseCase`, `ListAbsenceBalancesUseCase` y `ListAbsenceTypesUseCase` no tienen tests unitarios — son delegaciones puras al repositorio, cubiertas vía tests de integración HTTP.

---

## Decisiones tomadas y por qué

**Use cases atómicos (post INC-002)**: La implementación original agrupaba toda la lógica en `ManageAbsencesUseCase`. Refactorizado a 7 use cases atómicos siguiendo SRP. Formalizado en ADR-0001.

**`calculateWorkingDays` en dominio**: La función vive en el dominio (no en el controlador ni en el repositorio) porque el cálculo de días hábiles es lógica de negocio — determina si una solicitud tiene sentido y cuántos días consume del balance.

**Reserva en `pending_days` al solicitar**: Al crear la solicitud se reservan los días inmediatamente (`pending_days += n`). Esto evita que dos solicitudes simultáneas del mismo empleado consuman más días de los disponibles. La reserva se libera al rechazar o cancelar; se convierte en `used_days` al aprobar.

**`findOrCreateBalance` con upsert**: El balance de un empleado para un tipo/año se crea automáticamente en el primer acceso con la asignación del tipo. Esto elimina la necesidad de un paso de inicialización manual de balances al comienzo del año.

**`releasePendingDays` con `GREATEST(0, ...)`**: La query de liberación usa `GREATEST(0, pending_days - n)` para proteger contra condiciones de carrera donde dos cancelaciones simultáneas podrían llevar `pending_days` a negativo.

---

## Side-effects manejados

- `packages/core/src/contracts/index.ts` actualizado con tipos y contratos de absences
- `packages/core/src/index.ts` actualizado con los 7 use cases atómicos y `AbsenceBalance`
- `packages/boundary-postgres/src/index.ts` actualizado con `AbsenceRepository`
- `packages/api/src/container.ts` con `absenceRepo` e instancias de los 7 use cases atómicos
- `packages/api/src/index.ts` con rutas `/absence-types`, `/absence-requests`, `/employees/:id/absence-balances`

---

## Deuda técnica

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | `calculateWorkingDays` no considera festivos por país | bajo (v1 documentado así) | v2 |
| 2 | Balance inicial fijo desde `absence_types.annual_allowance_days` — no hay ajuste individual por empleado | bajo | cuando se requiera |
| 3 | Tests unitarios de listado (list-requests, list-balances, list-types) pendientes | bajo | antes de go-live |

---

## Desviaciones del spec original

Ninguna — la implementación siguió el spec exactamente. El refactor INC-002 es una corrección arquitectónica interna; no cambia contratos de API ni invariantes del sistema.
