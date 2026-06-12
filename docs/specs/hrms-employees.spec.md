# SDD Spec: hrms-employees

**Feature**: Expediente de empleados — CRUD, departamentos, estados, onboarding
**User story**: Como HR Manager quiero gestionar el ciclo de vida del expediente de cada empleado desde su alta hasta su baja lógica
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 2 de 10
**Dependencias**: hrms-auth-roles completo

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Baja de empleados | Lógica: status→INACTIVE + termination_date. Nunca DELETE físico |
| Empleado inactivo | Solo lectura — cualquier PATCH retorna 422 |
| Estados | ACTIVE, REMOTE, ON_LEAVE, INACTIVE |
| Onboarding | Creado automáticamente al dar de alta; pasos: documents, equipment, training, access, complete |
| Email corporativo | Único en el sistema — constraint DB + validación en dominio |
| Documento de identidad | Único en el sistema — constraint DB + validación en dominio |
| Rama Git | `feat/hrms-employees` (parte desde main después de merge de auth-roles) |

---

## Modelo de datos

```sql
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(255) NOT NULL,
  document_id      VARCHAR(50)  NOT NULL UNIQUE,
  corporate_email  VARCHAR(255) NOT NULL UNIQUE,
  department_id    UUID NOT NULL REFERENCES departments(id),
  job_title        VARCHAR(100) NOT NULL,
  salary           NUMERIC(15,2) NOT NULL CHECK (salary > 0),
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','REMOTE','ON_LEAVE','INACTIVE')),
  hire_date        DATE NOT NULL,
  termination_date DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inactive_requires_termination
    CHECK (status != 'INACTIVE' OR termination_date IS NOT NULL)
);

-- FK diferida (users se crea en hrms-auth-roles)
ALTER TABLE users ADD COLUMN employee_id UUID REFERENCES employees(id);

CREATE TABLE employee_onboarding (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  step         VARCHAR(20) NOT NULL
               CHECK (step IN ('documents','equipment','training','access','complete')),
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, step)
);
```

### Invariantes del modelo
1. `status = 'INACTIVE'` requiere `termination_date IS NOT NULL`.
2. `document_id` y `corporate_email` son únicos — error 409 en duplicado.
3. Empleado INACTIVE no acepta PATCH (dominio lanza error antes de DB).
4. Al crear un empleado se insertan automáticamente los 5 pasos de onboarding (documents, equipment, training, access, complete) todos con `completed = false`.

---

## Contratos de API

**GET /departments**
```
Response 200: Department[]
Requiere: can_view en 'employees'
```

**POST /departments**
```
Body:    { name: string }
Response 201: Department
Errores: 409 nombre duplicado
```

**GET /employees**
```
Query: ?department_id&status&search&page&limit
Response 200: { data: EmployeeSummary[], total: number, page: number }
EmployeeSummary: { id, full_name, department, job_title, status, hire_date }
Requiere: can_view en 'employees'
```

**POST /employees**
```
Body: {
  full_name, document_id, corporate_email,
  department_id, job_title, salary, hire_date
}
Response 201: Employee (con onboarding steps incluidos)
Efecto: crea employee + 5 onboarding steps + crea user con role 'employee'
Errores: 409 document_id duplicado | 409 corporate_email duplicado | 404 department no existe
```

**GET /employees/:id**
```
Response 200: Employee (con department, onboarding steps)
Errores: 404
```

**PATCH /employees/:id**
```
Body: Partial<{ full_name, department_id, job_title, salary, status }>
Response 200: Employee
Errores: 422 employee INACTIVE | 409 duplicado | 403
```

**POST /employees/:id/terminate**
```
Body: { termination_date: string (ISO date) }
Response 200: Employee (status=INACTIVE)
Efecto: status→INACTIVE, sets termination_date, desactiva user asociado
Errores: 422 ya INACTIVE | 422 termination_date en el futuro no permitida sin motivo
```

**GET /employees/:id/onboarding**
```
Response 200: OnboardingStep[]
```

**PATCH /employees/:id/onboarding/:step**
```
Body: { completed: boolean, notes?: string }
Response 200: OnboardingStep
Efecto: marca paso como completo/incompleto
```

---

## Máquina de estados del frontend

```
EMPLOYEES_LIST (tabla paginada, filtros por dept/status/búsqueda)
  → [+ nuevo empleado]   → CREATE_FORM
  → [click fila]         → EMPLOYEE_DETAIL
  → [exportar CSV]       → descarga directa (requiere can_export)

CREATE_FORM
  → [guardar exitoso]    → EMPLOYEE_DETAIL del nuevo empleado
  → [cancelar]           → EMPLOYEES_LIST

EMPLOYEE_DETAIL (tabs: Info, Onboarding, Documentos*, Ausencias*, Nómina*)
  → [editar]             → EDIT_FORM
  → [dar de baja]        → TERMINATE_CONFIRM_MODAL
  (* tabs activos en sub-specs posteriores)

EDIT_FORM
  → [guardar]            → EMPLOYEE_DETAIL
  → [cancelar]           → EMPLOYEE_DETAIL

TERMINATE_CONFIRM_MODAL
  → [confirmar fecha]    → EMPLOYEE_DETAIL (status=INACTIVE, formulario read-only)
  → [cancelar]           → EMPLOYEE_DETAIL

EMPLOYEE_DETAIL (INACTIVE)
  → Solo lectura. Ningún botón de edición visible.
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | PATCH /employees/:id retorna 422 si employee.status = 'INACTIVE' |
| 2 | Al terminar un empleado su user asociado se desactiva automáticamente (is_active=false) |
| 3 | La búsqueda por texto cubre full_name, document_id y corporate_email |
| 4 | El CSV exportado nunca incluye salary si el usuario no tiene can_export=true en 'employees' |
| 5 | Los 5 pasos de onboarding se crean en la misma transacción que el empleado |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/employees.ts` | NUEVO |
| `packages/core/src/domain/employee.ts` | NUEVO — entidad con invariante INACTIVE |
| `packages/core/src/domain/onboarding.ts` | NUEVO |
| `packages/core/src/usecases/create-employee.usecase.ts` | NUEVO |
| `packages/core/src/usecases/terminate-employee.usecase.ts` | NUEVO |
| `packages/core/src/usecases/update-onboarding.usecase.ts` | NUEVO |
| `packages/boundary-postgres/src/repositories/employee.repository.ts` | NUEVO |
| `packages/boundary-postgres/migrations/002_employees.sql` | NUEVO |
| `packages/api/src/controllers/employees.controller.ts` | NUEVO |
| `packages/api/src/controllers/departments.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/employees/` | NUEVO — list, detail, form, terminate |
| `apps/hrms-ui/src/assets/i18n/es.json` | MODIFICADO — claves employees.* |
| `apps/hrms-ui/src/assets/i18n/en.json` | MODIFICADO |
| `apps/hrms-ui/src/assets/i18n/pt.json` | MODIFICADO |

---

## Fuera de scope

- Foto de perfil / avatar del empleado (v2)
- Historial de cambios de salario (hrms-admin)
- Importación masiva de empleados por CSV (v2)
- Campos personalizados por empresa (v2)
