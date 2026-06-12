# SDD Spec: hrms-payroll

**Feature**: Nómina por período — cálculo de entries y cierre inmutable
**User story**: Como Finance Manager quiero procesar la nómina de cada período calculando el salario neto de cada empleado en base a su salario, asistencia y ausencias, y cerrar el período de forma permanente
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 6 de 10
**Dependencias**: hrms-employees + hrms-absences + hrms-attendance completos

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Nómina cerrada | Inmutable — status=CLOSED + is_locked=true en entries. Sin reapertura |
| Cálculo | salario_diario = salary/30; gross = salario_diario * worked_days; net = gross - deductions |
| Deducciones v1 | Manual (campo deductions por entry); sin cálculo fiscal automático |
| Procesamiento | Al procesar, se calculan entries para todos los empleados ACTIVE/REMOTE del período |
| Rama Git | `feat/hrms-payroll` (parte desde main después de merge de hrms-absences + hrms-attendance) |

---

## Modelo de datos

```sql
CREATE TABLE payroll_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN'
              CHECK (status IN ('OPEN','PROCESSING','CLOSED')),
  closed_at   TIMESTAMPTZ,
  closed_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (end_date > start_date),
  CONSTRAINT closed_has_timestamp CHECK (status != 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE TABLE payroll_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id    UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  base_salary  NUMERIC(15,2) NOT NULL,
  worked_days  NUMERIC(5,1) NOT NULL,
  absent_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(15,2) NOT NULL,
  deductions   NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary   NUMERIC(15,2) NOT NULL,
  is_locked    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id),
  CONSTRAINT positive_amounts CHECK (gross_salary >= 0 AND net_salary >= 0),
  CONSTRAINT net_coherent CHECK (net_salary = gross_salary - deductions)
);
```

### Invariantes del modelo
1. `status = 'CLOSED'` → todos los entries del período tienen `is_locked = true`.
2. Un entry con `is_locked = true` no puede ser modificado.
3. `net_salary = gross_salary - deductions` siempre.
4. Un período CLOSED no puede volver a OPEN o PROCESSING.

---

## Contratos de API

**GET /payroll/periods**
```
Query: ?status&page
Response 200: { data: PayrollPeriod[], total }
Requiere: can_view en 'payroll'
```

**POST /payroll/periods**
```
Body: { name, start_date, end_date }
Response 201: PayrollPeriod (status=OPEN)
Errores: 422 fechas solapadas con período existente | 403
```

**GET /payroll/periods/:id/entries**
```
Response 200: PayrollEntry[] (con employee info)
Requiere: can_view en 'payroll'
```

**POST /payroll/periods/:id/process**
```
Response 200: PayrollPeriod (status=PROCESSING)
Efecto: calcula entries para todos los empleados activos usando attendance_summary + absence_balances
Errores: 422 ya CLOSED | 403 solo finance/super_admin
```

**PATCH /payroll/entries/:id**
```
Body: { deductions?: number, notes?: string }
Response 200: PayrollEntry (net_salary recalculado)
Errores: 422 is_locked=true | 403
```

**POST /payroll/periods/:id/close**
```
Response 200: PayrollPeriod (status=CLOSED)
Efecto: is_locked=true en todos los entries, sets closed_at/by
Errores: 422 ya CLOSED | 422 status=OPEN (debe procesarse primero) | 403
```

---

## Máquina de estados del frontend

```
PERIODS_LIST
  → [+ nuevo período]    → PERIOD_FORM → PERIODS_LIST (OPEN)
  → [ver detalle]        → PERIOD_DETAIL

PERIOD_DETAIL (status=OPEN)
  → [procesar]           → PROCESS_CONFIRM → PERIOD_DETAIL (PROCESSING)

PERIOD_DETAIL (status=PROCESSING)
  → tabla de entries editables (solo deductions)
  → [cerrar nómina]      → CLOSE_CONFIRM_MODAL → PERIOD_DETAIL (CLOSED, solo lectura)

PERIOD_DETAIL (status=CLOSED)
  → Solo lectura. Sin botones de acción. Badge "CERRADO" en rojo.
  → [exportar]           → descarga CSV
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | PATCH en entry con is_locked=true retorna 422 |
| 2 | POST /close en período ya CLOSED retorna 422 |
| 3 | POST /process debe calcular worked_days desde attendance y absent_days desde absences |
| 4 | Solo usuarios con rol finance o super_admin pueden cerrar nómina |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/payroll.ts` | NUEVO |
| `packages/core/src/domain/payroll-period.ts` | NUEVO — con invariante CLOSED |
| `packages/core/src/domain/payroll-entry.ts` | NUEVO — con invariante is_locked |
| `packages/core/src/usecases/process-payroll.usecase.ts` | NUEVO — lee attendance + absences |
| `packages/core/src/usecases/close-payroll.usecase.ts` | NUEVO |
| `packages/boundary-postgres/migrations/006_payroll.sql` | NUEVO |
| `packages/api/src/controllers/payroll.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/payroll/` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves payroll.* |

---

## Fuera de scope

- Cálculo de impuestos y retenciones fiscales (v2)
- Múltiples monedas (v1 solo moneda base de la organización)
- Pago directo bancario (v2)
- Nómina extraordinaria/bonos (v2)
