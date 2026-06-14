# hrms-attendance

**Fecha**: 2026-06-14
**Estado**: Implementado
**Commit**: feat(hrms-attendance): implement attendance check-in/out tracking (sub-spec 5/10)

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

Hexagonal idéntico a los sub-specs anteriores: dominio puro → use case → repositorio port → adaptador postgres → controlador Hono.

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/attendance.ts` | contratos | Tipos AttendanceStatus, AttendanceRecordData, AttendanceSummary, IAttendanceRepository |
| `packages/core/src/domain/attendance-record.ts` | dominio | Clase AttendanceRecord con assertCanCheckOut, assertNoExistingCheckIn, toDateString |
| `packages/core/src/usecases/manage-attendance.usecase.ts` | aplicación | ManageAttendanceUseCase: listRecords, getSummary, checkIn, checkOut, editRecord |
| `packages/boundary-postgres/src/migrations/005_attendance.sql` | infra | CREATE TABLE attendance_records con GENERATED ALWAYS AS |
| `packages/boundary-postgres/src/repositories/attendance.repository.ts` | infra | AttendanceRepository implementando IAttendanceRepository |
| `packages/api/src/controllers/attendance.controller.ts` | API | createAttendanceController — 5 routes, /summary registrada antes de /:id |
| `apps/hrms-ui/src/app/attendance/attendance.service.ts` | UI | AttendanceService: list, getSummary, checkIn, checkOut, edit |
| `apps/hrms-ui/src/app/attendance/attendance-page.component.ts` | UI | Smart component con resumen, filtros, tabla, check-in/out buttons, modal de edición |
| `apps/hrms-ui/src/app/app.routes.ts` | UI | Ruta `/attendance` con permissionGuard(AppModule.ATTENDANCE, 'canView') |
| `apps/hrms-ui/src/assets/i18n/es.json` | UI | Claves attendance.* |
| `apps/hrms-ui/src/assets/i18n/en.json` | UI | Claves attendance.* |
| `apps/hrms-ui/src/assets/i18n/pt.json` | UI | Claves attendance.* |
| `docs/security-debt.md` | docs | 3 hallazgos SEC-AT1..3 |

---

## Cómo se verifica

### Tests de backend

| Test | Capa | Qué verifica |
|---|---|---|
| `assertCanCheckOut: passes when after checkIn` | dominio | happy path checkout |
| `assertCanCheckOut: throws when no checkIn` | dominio | invariante — no checkout sin checkin |
| `assertCanCheckOut: throws when timestamp before checkIn` | dominio | invariante — checkout posterior |
| `assertNoExistingCheckIn: passes when null` | dominio | no duplicado |
| `assertNoExistingCheckIn: throws ConflictError when record exists` | dominio | invariante — un checkin por día |
| `toDateString: returns YYYY-MM-DD` | dominio | formato de fecha |
| `checkIn: happy path` | use case | crea registro correctamente |
| `checkIn: throws NotFoundError when employee not found` | use case | validación de existencia |
| `checkIn: throws ValidationError when employee inactive` | use case | invariante activo |
| `checkIn: throws ConflictError when duplicate` | use case | invariante unicidad |
| `checkOut: happy path` | use case | actualiza registro |
| `checkOut: throws ValidationError when no checkIn` | use case | delega a dominio |
| `checkOut: throws ValidationError when timestamp before checkIn` | use case | delega a dominio |
| `editRecord: happy path` | use case | actualiza campos |
| `editRecord: throws NotFoundError` | use case | validación de existencia |
| `editRecord: throws ValidationError when checkOut before checkIn` | use case | invariante temporal |
| `getSummary: delegates to repository` | use case | delegación correcta |

---

## Decisiones tomadas y por qué

**GENERATED ALWAYS AS para hours_worked**: PostgreSQL calcula el campo automáticamente al insertar o actualizar `check_in`/`check_out`. El repositorio nunca escribe `hours_worked` directamente — esto garantiza consistencia matemática sin código de aplicación. Alternativa descartada: calcular en el use case y persistir como columna normal (riesgo de inconsistencia si alguien actualiza la DB directamente).

**Ruta `/summary` antes de `/:id`**: En Hono, las rutas se evalúan en orden de registro. Si `/:id` se registra primero, la URL `/summary` es capturada como `id = "summary"` y el repositorio intenta buscar un UUID "summary". Se registra `/summary` primero para que sea evaluada antes. Mismo patrón que `/documents/expiring`.

**`toDateString` en dominio**: La función que extrae la fecha de un timestamp vive en el dominio (no en el repositorio ni en el controlador) porque es parte de la lógica de negocio — la fecha del registro se deriva del timestamp del check-in, no del timestamp de creación en DB.

**Validación cruzada en editRecord**: Cuando se editan `check_in` y `check_out` simultáneamente, se valida en el use case antes de llamar al repositorio. Si solo se edita uno de los dos, se toman los valores existentes del repositorio para la validación.

---

## Side-effects manejados

- `packages/core/src/contracts/index.ts` actualizado con tipos de attendance
- `packages/core/src/index.ts` actualizado con ManageAttendanceUseCase y AttendanceRecord
- `packages/boundary-postgres/src/index.ts` actualizado con AttendanceRepository
- `packages/api/src/container.ts` con attendanceRepo y manageAttendanceUseCase
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

Ninguna — implementación siguió el spec exactamente.
