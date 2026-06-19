# hrms-attendance

**Fecha**: 2026-06-14
**Estado**: Implementado
**Actualizado**: 2026-06-18 — post INC-002 (refactor a use cases atómicos, ver `docs/sdd-incident-log.md`)
**Commits**:
- `805662c` feat(hrms-attendance): implement attendance check-in/out tracking (sub-spec 5/10)
- `d083f6a` feat(hrms-attendance): merge sub-spec 5/10 into master
- INC-002 refactor incluido en el commit de resolución `cb0a403`

---

## Qué es este feature

Registro de asistencia de empleados con soporte para entrada/salida (check-in/check-out), cálculo automático de horas trabajadas y edición administrativa de registros.

Permite a empleados fichar su entrada y salida del día, y a administradores de RRHH ver y corregir registros de asistencia. Los resúmenes mensuales muestran conteos de días presentes, ausentes, con tardanza y horas totales trabajadas.

---

## Qué se construyó

### Modelo de datos

**Tabla `attendance_records`**

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() |
| `employee_id` | UUID | FK employees(id) ON DELETE CASCADE |
| `date` | DATE | NOT NULL |
| `check_in` | TIMESTAMPTZ | NULL |
| `check_out` | TIMESTAMPTZ | NULL |
| `hours_worked` | NUMERIC(4,2) | GENERATED ALWAYS AS (CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (check_out - check_in))/3600, 2) ELSE NULL END) STORED |
| `status` | TEXT | CHECK IN ('PRESENT','ABSENT','LATE','ON_LEAVE','HOLIDAY') |
| `notes` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

UNIQUE: `(employee_id, date)`

**Índices**: `idx_attendance_employee`, `idx_attendance_date`, `idx_attendance_status`

### Contratos de API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/attendance` | canView | Lista registros con filtros opcionales (employee_id, status, from, to, page, limit) |
| GET | `/attendance/summary` | canView | Resumen agregado para un empleado en un rango de fechas |
| POST | `/attendance/check-in` | canCreate | Registra la entrada del día |
| POST | `/attendance/check-out` | canCreate | Registra la salida del día |
| PATCH | `/attendance/:id` | canEdit | Edita campos de un registro existente |

**POST /attendance/check-in** body: `{ employee_id: UUID, timestamp: ISO8601 }`
**POST /attendance/check-out** body: `{ employee_id: UUID, timestamp: ISO8601 }`
**PATCH /attendance/:id** body: `{ check_in?, check_out?, status?, notes? }`

**Errores**: 409 ConflictError (check-in duplicado), 422 ValidationError (check-out sin check-in, timestamp anterior), 404 NotFoundError

### Invariantes del sistema

1. No puede haber dos registros de asistencia para el mismo empleado el mismo día
2. `check_out` debe ser posterior a `check_in` en el mismo registro
3. No se puede hacer check-out sin haber hecho check-in previamente
4. `hours_worked` es calculado por la base de datos — nunca se escribe directamente
5. El empleado debe estar activo para registrar asistencia

---

## Cómo está estructurado el código

### Patrón arquitectónico

Hexagonal idéntico a los sub-specs anteriores: dominio puro → use cases atómicos → repositorio port con composición de contratos → adaptador postgres → controlador Hono.

> **Nota INC-002**: La implementación original usaba `ManageAttendanceUseCase` (clase con 5 métodos). Refactorizada a 5 use cases atómicos según ADR-0001.

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/attendance.ts` | contratos | Tipos `AttendanceStatus`, `AttendanceRecordData`, `AttendanceSummary`; contratos atómicos `CheckInRepository`, `CheckOutRepository`, `EditAttendanceRecordRepository`, `GetAttendanceSummaryRepository`, `ListAttendanceRecordsRepository`; puerto completo `IAttendanceRepository` |
| `packages/core/src/domain/attendance-record.ts` | dominio | Clase `AttendanceRecord` con `assertCanCheckOut`; funciones puras `assertNoExistingCheckIn`, `toDateString` |
| `packages/core/src/usecases/check-in.usecase.ts` | aplicación | `CheckInUseCase` — registra entrada validando empleado activo y unicidad del día |
| `packages/core/src/usecases/check-out.usecase.ts` | aplicación | `CheckOutUseCase` — registra salida validando existencia de check-in y orden temporal |
| `packages/core/src/usecases/edit-attendance-record.usecase.ts` | aplicación | `EditAttendanceRecordUseCase` — correcciones administrativas con validación cruzada check_in/check_out |
| `packages/core/src/usecases/get-attendance-summary.usecase.ts` | aplicación | `GetAttendanceSummaryUseCase` — delega al repositorio el cálculo de métricas agregadas |
| `packages/core/src/usecases/list-attendance-records.usecase.ts` | aplicación | `ListAttendanceRecordsUseCase` — listado paginado con filtros |
| `packages/boundary-postgres/src/migrations/005_attendance.sql` | infra | CREATE TABLE attendance_records con GENERATED ALWAYS AS |
| `packages/boundary-postgres/src/repositories/attendance.repository.ts` | infra | `AttendanceRepository` implementando `IAttendanceRepository` |
| `packages/api/src/controllers/attendance.controller.ts` | API | `createAttendanceController` — 5 rutas; `/summary` registrada antes de `/:id` |
| `apps/hrms-ui/src/app/attendance/attendance.service.ts` | UI | `AttendanceService`: list, getSummary, checkIn, checkOut, edit |
| `apps/hrms-ui/src/app/attendance/attendance-page.component.ts` | UI | Smart component con resumen, filtros, tabla, botones check-in/out, modal de edición |
| `apps/hrms-ui/src/app/app.routes.ts` | UI | Ruta `/attendance` con `permissionGuard(AppModule.ATTENDANCE, 'canView')` |
| `apps/hrms-ui/src/assets/i18n/es.json` | UI | Claves `attendance.*` |
| `apps/hrms-ui/src/assets/i18n/en.json` | UI | Claves `attendance.*` |
| `apps/hrms-ui/src/assets/i18n/pt.json` | UI | Claves `attendance.*` |
| `docs/security-debt.md` | docs | 3 hallazgos SEC-AT1..3 |

---

## Cómo se verifica

### Tests de dominio (`packages/core-tests/src/domain/attendance-record.test.ts`)

| Test | Qué verifica |
|---|---|
| `assertCanCheckOut_passes_when_timestamp_after_checkIn` | happy path checkout |
| `assertCanCheckOut_throws_when_no_checkIn` | invariante — no checkout sin checkin |
| `assertCanCheckOut_throws_when_timestamp_before_checkIn` | invariante — checkout posterior |
| `passes_when_no_existing_record` | assertNoExistingCheckIn — sin duplicado |
| `throws_ConflictError_when_record_exists` | assertNoExistingCheckIn — invariante unicidad |
| `returns_YYYY-MM-DD_portion` | toDateString — formato de fecha |

### Tests de use cases (`packages/core-tests/src/usecases/`)

| Test | Use case | Qué verifica |
|---|---|---|
| `creates_record_for_active_employee_with_no_prior_checkin` | CheckInUseCase | happy path |
| `throws_NotFoundError_when_employee_not_found` | CheckInUseCase | validación de existencia |
| `throws_ValidationError_when_employee_is_INACTIVE` | CheckInUseCase | invariante activo |
| `throws_ConflictError_when_already_checked_in_today` | CheckInUseCase | invariante unicidad |
| `updates_checkout_when_checkin_exists_and_timestamp_is_valid` | CheckOutUseCase | happy path |
| `throws_ValidationError_when_no_checkin_today` | CheckOutUseCase | delega a dominio |
| `throws_ValidationError_when_checkout_before_checkin` | CheckOutUseCase | delega a dominio |
| `updates_record_when_found` | EditAttendanceRecordUseCase | happy path |
| `throws_NotFoundError_when_record_not_found` | EditAttendanceRecordUseCase | validación de existencia |
| `throws_ValidationError_when_checkout_before_checkin_in_edit` | EditAttendanceRecordUseCase | invariante temporal en edición |
| `delegates_to_repository` | GetAttendanceSummaryUseCase | delegación correcta |
| `delegates_to_repository` | ListAttendanceRecordsUseCase | delegación correcta |

---

## Decisiones tomadas y por qué

**Use cases atómicos (post INC-002)**: La implementación original agrupaba toda la lógica en `ManageAttendanceUseCase`. Refactorizado a 5 use cases atómicos siguiendo SRP — cada use case tiene una sola razón para cambiar. Formalizado en ADR-0001.

**Composición de contratos**: Cada use case depende solo del contrato mínimo que necesita (`CheckInRepository`, `CheckOutRepository`, etc.). El puerto completo `IAttendanceRepository` los une para el adaptador. Esto permite testar cada use case con un mock minimal.

**GENERATED ALWAYS AS para hours_worked**: PostgreSQL calcula el campo automáticamente al insertar o actualizar `check_in`/`check_out`. El repositorio nunca escribe `hours_worked` directamente — garantiza consistencia matemática sin código de aplicación. Alternativa descartada: calcular en el use case y persistir como columna normal (riesgo de inconsistencia ante modificaciones directas en DB).

**Ruta `/summary` antes de `/:id`**: En Hono, las rutas se evalúan en orden de registro. Si `/:id` se registra primero, `/summary` es capturada como `id = "summary"` y el repositorio intenta buscar un UUID inválido. Mismo patrón que `/documents/expiring`.

**`toDateString` en dominio**: La función vive en el dominio porque la fecha del registro se deriva del timestamp del check-in — es lógica de negocio, no mapeo de persistencia.

**Validación cruzada en EditAttendanceRecordUseCase**: Cuando se editan `check_in` y `check_out` simultáneamente, se valida antes de llamar al repositorio. Cuando solo se edita `check_out`, se toman los valores del registro existente para la comparación.

---

## Side-effects manejados

- `packages/core/src/contracts/index.ts` actualizado con tipos y contratos de attendance
- `packages/core/src/index.ts` actualizado con los 5 use cases atómicos y `AttendanceRecord`
- `packages/boundary-postgres/src/index.ts` actualizado con `AttendanceRepository`
- `packages/api/src/container.ts` con `attendanceRepo` e instancias de los 5 use cases atómicos
- `packages/api/src/index.ts` con ruta `/attendance`

---

## Deuda técnica

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | SEC-AT1: PATCH no verifica ownership por employeeId | bajo (requiere canEdit) | antes de go-live |
| 2 | SEC-AT2: GET sin filtro devuelve todos los registros | bajo (requiere canView) | antes de go-live |
| 3 | SEC-AT3: check-in/out no verifica que el body.employee_id sea el usuario autenticado | medio | antes de go-live |
| 4 | No hay integración con holidays — status HOLIDAY se setea manualmente | bajo | siguiente sprint |

---

## Desviaciones del spec original

Ninguna — la implementación siguió el spec exactamente. El refactor INC-002 es una corrección arquitectónica interna; no cambia contratos de API ni invariantes del sistema.
