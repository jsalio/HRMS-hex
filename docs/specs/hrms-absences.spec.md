# SDD Spec: hrms-absences

**Feature**: Solicitudes de ausencia, balances y flujo de aprobación
**User story**: Como empleado quiero solicitar ausencias y como gerente quiero aprobarlas o rechazarlas, con descuento automático del balance disponible
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 4 de 10
**Dependencias**: hrms-employees completo

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Balance insuficiente | Rechazo automático — no llega a pendiente de aprobación |
| Balance reservado | Al crear solicitud PENDING se reservan días en `pending_days` |
| Cancelación | Solo el propio empleado puede cancelar su solicitud PENDING |
| Aprobadores | Usuarios con rol hr_manager o super_admin |
| Días hábiles | working_days se calcula excluyendo sábados y domingos (sin festivos en v1) |
| Rama Git | `feat/hrms-absences` (parte desde main después de merge de hrms-employees) |

---

## Modelo de datos

```sql
CREATE TABLE absence_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL UNIQUE,
  annual_allowance_days INTEGER NOT NULL DEFAULT 0,
  requires_approval     BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE absence_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  absence_type_id UUID NOT NULL REFERENCES absence_types(id),
  year            INTEGER NOT NULL,
  allocated_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  pending_days    NUMERIC(5,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, absence_type_id, year),
  CONSTRAINT non_negative CHECK (allocated_days >= 0 AND used_days >= 0 AND pending_days >= 0),
  CONSTRAINT balance_coherent CHECK (used_days + pending_days <= allocated_days)
);

CREATE TABLE absence_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  absence_type_id UUID NOT NULL REFERENCES absence_types(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  working_days    NUMERIC(5,1) NOT NULL,
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT working_days_positive CHECK (working_days > 0)
);

-- Seed: tipos de ausencia estándar
INSERT INTO absence_types (name, annual_allowance_days, requires_approval) VALUES
  ('vacation', 15, true),
  ('sick_leave', 10, false),
  ('personal', 3, true),
  ('maternity', 84, true),
  ('paternity', 14, true);
```

### Invariantes del modelo
1. `used_days + pending_days <= allocated_days` — constraint en DB y validación en dominio.
2. Al aprobar: `pending_days -= working_days`, `used_days += working_days`.
3. Al rechazar/cancelar: `pending_days -= working_days` (se libera la reserva).
4. Al crear solicitud PENDING: `pending_days += working_days` (se reserva).

---

## Contratos de API

**GET /absence-types**
```
Response 200: AbsenceType[]
```

**GET /employees/:id/absence-balances**
```
Query: ?year (default: año actual)
Response 200: AbsenceBalance[] (con absence_type info)
```

**GET /absence-requests**
```
Query: ?employee_id&status&from&to&page
Response 200: { data: AbsenceRequest[], total, page }
Requiere: can_view en 'absences'
```

**POST /absence-requests**
```
Body: { employee_id, absence_type_id, start_date, end_date, reason? }
Response 201: AbsenceRequest (status=PENDING)
Efecto: calcula working_days, verifica balance, reserva pending_days
Errores: 422 balance insuficiente | 422 fechas solapadas con solicitud existente | 404 employee
```

**PATCH /absence-requests/:id/approve**
```
Body: { notes?: string }
Response 200: AbsenceRequest (status=APPROVED)
Efecto: pending_days-=, used_days+=, sets reviewed_by/at
Requiere: rol hr_manager o super_admin
Errores: 422 no está PENDING | 403
```

**PATCH /absence-requests/:id/reject**
```
Body: { notes: string }
Response 200: AbsenceRequest (status=REJECTED)
Efecto: pending_days -= working_days (libera reserva)
Requiere: rol hr_manager o super_admin
Errores: 422 no está PENDING | 403
```

**PATCH /absence-requests/:id/cancel**
```
Response 200: AbsenceRequest (status=CANCELLED)
Efecto: pending_days -= working_days
Requiere: mismo employee_id que la solicitud
Errores: 422 no está PENDING | 403 otro usuario
```

---

## Máquina de estados del frontend

### Vista empleado
```
MY_ABSENCES (balance + solicitudes propias)
  → [+ solicitar ausencia]   → REQUEST_FORM
  → [cancelar solicitud]     → CANCEL_CONFIRM (solo PENDING)

REQUEST_FORM
  → selecciona tipo, fechas
  → [balance suficiente]     → PENDING_CREATED
  → [balance insuficiente]   → ERROR_NO_BALANCE (formulario bloqueado)
```

### Vista manager (Gestión de Aprobaciones)
```
APPROVALS_QUEUE (solicitudes PENDING de su equipo)
  → [aprobar]    → APPROVE_CONFIRM_MODAL → queue actualizada
  → [rechazar]   → REJECT_MODAL (motivo obligatorio) → queue actualizada
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | Solicitud con balance insuficiente retorna 422 — nunca queda PENDING |
| 2 | El balance nunca puede ser negativo en ninguna operación |
| 3 | Solo el propietario puede cancelar su solicitud |
| 4 | Solo hr_manager/super_admin pueden aprobar o rechazar |
| 5 | Solicitudes solapadas del mismo empleado y tipo retornan 422 |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/absences.ts` | NUEVO |
| `packages/core/src/domain/absence-balance.ts` | NUEVO — con invariante balance |
| `packages/core/src/usecases/request-absence.usecase.ts` | NUEVO |
| `packages/core/src/usecases/approve-absence.usecase.ts` | NUEVO |
| `packages/boundary-postgres/migrations/004_absences.sql` | NUEVO |
| `packages/api/src/controllers/absences.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/absences/` | NUEVO — my-absences, approvals-queue, request-form |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves absences.* |

---

## Fuera de scope

- Festivos y días no laborables (v2 con configuración por país)
- Notificaciones de aprobación/rechazo (hrms-notifications)
- Reportes de ausencias por departamento (hrms-admin)
- Ausencias de medio día
