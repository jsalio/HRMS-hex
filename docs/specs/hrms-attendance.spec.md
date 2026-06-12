# SDD Spec: hrms-attendance

**Feature**: Registro de asistencia diaria (check-in/check-out) y cálculo de horas trabajadas
**User story**: Como empleado quiero registrar mi entrada y salida diaria; como HR quiero ver el historial de asistencia para calcular nómina
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 5 de 10
**Dependencias**: hrms-employees completo

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Un registro por empleado/día | UNIQUE(employee_id, date) — constraint en DB |
| Horas calculadas | Columna generada en DB: (check_out - check_in) en horas |
| Check-in sin check-out | Registro válido — hours_worked = NULL hasta check-out |
| Edición manual | Solo hr_manager/super_admin pueden corregir registros |
| Rama Git | `feat/hrms-attendance` (parte desde main después de merge de hrms-employees) |

---

## Modelo de datos

```sql
CREATE TABLE attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  hours_worked NUMERIC(4,2) GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (check_out - check_in))/3600, 2)
    ELSE NULL END
  ) STORED,
  status       VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
               CHECK (status IN ('PRESENT','ABSENT','LATE','ON_LEAVE','HOLIDAY')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date),
  CONSTRAINT checkout_after_checkin
    CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in)
);
```

### Invariantes del modelo
1. Solo un registro por empleado por día.
2. `check_out > check_in` cuando ambos están presentes.
3. `hours_worked` es columna generada — nunca se escribe directamente.

---

## Contratos de API

**GET /attendance**
```
Query: ?employee_id&from&to&status&page
Response 200: { data: AttendanceRecord[], total, page }
Requiere: can_view en 'attendance'
```

**POST /attendance/check-in**
```
Body: { employee_id, timestamp: string (ISO) }
Response 201: AttendanceRecord (check_in set, check_out null)
Efecto: crea registro con status=PRESENT
Errores: 409 ya existe check-in hoy | 422 employee INACTIVE
```

**POST /attendance/check-out**
```
Body: { employee_id, timestamp: string (ISO) }
Response 200: AttendanceRecord (check_out set, hours_worked calculado)
Errores: 422 no hay check-in previo hoy | 422 timestamp < check_in
```

**PATCH /attendance/:id**
```
Body: Partial<{ check_in, check_out, status, notes }>
Response 200: AttendanceRecord
Requiere: can_edit en 'attendance' (hr_manager/super_admin)
Errores: 422 check_out < check_in | 403
```

**GET /attendance/summary**
```
Query: ?employee_id&from&to
Response 200: {
  total_days: number,
  present_days: number,
  absent_days: number,
  late_days: number,
  total_hours: number
}
Usado por hrms-payroll para calcular días trabajados
```

---

## Máquina de estados del frontend

```
ATTENDANCE_VIEW (tabla por período, filtrable por empleado)
  → [check-in]         → registro creado (botón cambia a "check-out")
  → [check-out]        → registro completado con horas
  → [editar registro]  → EDIT_MODAL (solo admin/hr)
  → [exportar]         → descarga CSV

EDIT_MODAL (admin/hr only)
  → corrige check_in / check_out / status / notes
  → [guardar]          → tabla actualizada
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | Dos check-ins el mismo día para el mismo empleado → 409 |
| 2 | check-out sin check-in previo → 422 |
| 3 | Edición de registros solo para roles con can_edit en 'attendance' |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/attendance.ts` | NUEVO |
| `packages/core/src/domain/attendance-record.ts` | NUEVO |
| `packages/core/src/usecases/check-in.usecase.ts` | NUEVO |
| `packages/core/src/usecases/check-out.usecase.ts` | NUEVO |
| `packages/boundary-postgres/migrations/005_attendance.sql` | NUEVO |
| `packages/api/src/controllers/attendance.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/attendance/` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves attendance.* |

---

## Fuera de scope

- Integración con dispositivos biométricos (v2)
- Geolocalización de check-in (v2)
- Horas extra y turnos rotativos (v2)
- Festivos por país (v2)
