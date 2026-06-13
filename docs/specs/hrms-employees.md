# hrms-employees — Expediente de Empleados

**Fecha**: 2026-06-13
**Estado**: Implementado
**Commit**: feat(hrms-employees): implement employee management — CRUD, departments, onboarding, Angular UI
**Sub-spec**: 2 de 10 del sistema HRMS-HEX

---

## Qué es este feature

Este sub-spec agrega la gestión del ciclo de vida del empleado: desde el alta hasta la baja lógica. El HR Manager puede crear expedientes, actualizarlos, asignarlos a departamentos, y dar de baja a empleados con una fecha de egreso. Los empleados dados de baja quedan en solo lectura y su cuenta de usuario se desactiva automáticamente.

Cada empleado tiene un proceso de onboarding con 5 pasos (documentación, equipos, capacitación, accesos, completado) que se crean automáticamente al dar de alta al empleado. El HR Manager puede marcar y desmarcar pasos conforme avanza el proceso.

---

## Qué se construyó

### Modelo de datos

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

-- FK a users (tabla de hrms-auth-roles)
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

Seed: 5 departamentos por defecto (Human Resources, Finance, Engineering, Operations, Sales).

### Contratos de API

| Método | Ruta | Descripción |
|---|---|---|
| GET | /departments | Lista departamentos |
| POST | /departments | Crear departamento (409 nombre duplicado) |
| GET | /employees | Lista paginada con filtros (dept, status, search) |
| POST | /employees | Crear empleado + onboarding + user account |
| GET | /employees/:id | Detalle con onboarding |
| PATCH | /employees/:id | Actualizar (422 si INACTIVE) |
| POST | /employees/:id/terminate | Dar de baja + desactivar user |
| GET | /employees/:id/onboarding | Pasos de onboarding |
| PATCH | /employees/:id/onboarding/:step | Marcar paso completado/pendiente |

### Invariantes del sistema

1. `status = 'INACTIVE'` requiere `termination_date IS NOT NULL` (constraint DB + validación de dominio).
2. `document_id` y `corporate_email` son únicos en el sistema — 409 en duplicado.
3. Empleado INACTIVE no acepta PATCH — el dominio lanza `ValidationError` antes de llegar a DB.
4. Los 5 pasos de onboarding se crean en la misma transacción que el empleado.
5. Al terminar un empleado, su cuenta de usuario se desactiva y todos sus refresh tokens se revocan.

---

## Cómo está estructurado el código

### Patrón arquitectónico

Hexagonal idéntico al establecido en `hrms-auth-roles`: Core (contratos + dominio + usecases) ← Boundary-postgres (repositorios) ← API (Hono controllers) ← UI (Angular standalone).

### Archivos creados / modificados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/employees.ts` | Core/Contratos | Tipos, interfaces IEmployeeRepository, IDepartmentRepository |
| `packages/core/src/domain/employee.ts` | Core/Dominio | Entidad Employee con assertCanBeModified/assertCanBeTerminated |
| `packages/core/src/domain/errors.ts` | Core/Dominio | + ValidationError (nuevo tipo de error) |
| `packages/core/src/usecases/manage-employees.usecase.ts` | Core/UseCases | createEmployee, updateEmployee, terminateEmployee |
| `packages/core/src/usecases/manage-departments.usecase.ts` | Core/UseCases | createDepartment, listDepartments |
| `packages/boundary-postgres/src/migrations/002_employees.sql` | Infra/DB | Tablas departments, employees, employee_onboarding + seed |
| `packages/boundary-postgres/src/migrate.ts` | Infra/DB | Fix: ahora descubre y ordena todos los .sql dinámicamente |
| `packages/boundary-postgres/src/repositories/employee.repository.ts` | Infra/Repo | Implementación IEmployeeRepository |
| `packages/boundary-postgres/src/repositories/department.repository.ts` | Infra/Repo | Implementación IDepartmentRepository |
| `packages/api/src/mappers/employee.mapper.ts` | API | Mappers domain → DTO |
| `packages/api/src/controllers/employees.controller.ts` | API | 7 endpoints + Zod validation |
| `packages/api/src/controllers/departments.controller.ts` | API | 2 endpoints |
| `packages/api/src/container.ts` | API/DI | + EmployeeRepository, DepartmentRepository, ManageEmployeesUseCase |
| `packages/api/src/index.ts` | API | + routes /employees, /departments |
| `apps/hrms-ui/src/app/employees/employees.service.ts` | UI/Service | HTTP client para todos los endpoints |
| `apps/hrms-ui/src/app/employees/employees.routes.ts` | UI/Routing | Lazy routes del módulo employees |
| `apps/hrms-ui/src/app/employees/employees-list-page.component.ts` | UI/Smart | Tabla paginada, filtros, búsqueda debounced |
| `apps/hrms-ui/src/app/employees/employee-detail-page.component.ts` | UI/Smart | Tabs Info + Onboarding, modal de baja |
| `apps/hrms-ui/src/app/employees/employee-form-page.component.ts` | UI/Smart | Formulario create/edit compartido |
| `apps/hrms-ui/src/app/app.routes.ts` | UI/Routing | + ruta /employees con permissionGuard |
| `apps/hrms-ui/src/assets/i18n/es.json` | UI/i18n | + employees.* keys (ES) |
| `apps/hrms-ui/src/assets/i18n/en.json` | UI/i18n | + employees.* keys (EN) |
| `apps/hrms-ui/src/assets/i18n/pt.json` | UI/i18n | + employees.* keys (PT) |

---

## Cómo se verifica

### Tests de backend

| Test | Capa | Qué verifica |
|---|---|---|
| `active employee can be modified` | dominio | assertCanBeModified no lanza en ACTIVE |
| `remote employee can be modified` | dominio | assertCanBeModified no lanza en REMOTE |
| `on_leave employee can be modified` | dominio | assertCanBeModified no lanza en ON_LEAVE |
| `inactive employee throws ValidationError` | dominio | assertCanBeModified lanza en INACTIVE |
| `inactive employee error message describes the constraint` | dominio | mensaje exacto del error |
| `active employee can be terminated` | dominio | assertCanBeTerminated no lanza en ACTIVE |
| `already inactive employee throws ValidationError` | dominio | assertCanBeTerminated lanza en INACTIVE |
| `already inactive employee error message` | dominio | mensaje exacto |
| `creates employee and returns detail with 5 onboarding steps` | usecase | happy path create |
| `also creates an associated user account` | usecase | side effect: userRepo.create llamado |
| `throws NotFoundError when department does not exist` | usecase | 404 dept |
| `throws ConflictError when corporate email already in use` | usecase | 409 email |
| `throws ConflictError when document_id already in use` | usecase | 409 docId |
| `throws ValidationError when employee is INACTIVE (update)` | usecase | 422 inactive |
| `returns employee with INACTIVE status (terminate)` | usecase | terminate llama repo.terminate |
| `deactivates associated user account` | usecase | userRepo.deactivate + revokeAllForUser |
| `throws ValidationError when employee is already INACTIVE (terminate)` | usecase | 422 double terminate |

Total: 17 tests, todos passing.

---

## Decisiones tomadas y por qué

### ManageEmployeesUseCase consolida 3 casos de uso del spec

El spec original definía `CreateEmployeeUseCase`, `TerminateEmployeeUseCase`, y `UpdateOnboardingUseCase` como archivos separados. Se consolidaron en un único `ManageEmployeesUseCase` por la misma razón que en hrms-auth-roles: los casos de uso del mismo dominio comparten dependencias (employeeRepo, deptRepo, userRepo) y la separación solo agregaría archivos sin valor. El nombre del archivo en el spec se documenta como desviación.

### migrate.ts hardcodeado a 001

El archivo original solo cargaba `001_auth.sql`. Se corrigió para descubrir y ordenar todos los `.sql` dinámicamente usando `readdirSync().sort()`. Sin este fix la migración 002 nunca se ejecutaría.

### Onboarding en transacción de BD pero user en paso separado

La creación del empleado + sus 5 pasos de onboarding ocurre en una sola transacción `sql.begin()` en el repositorio. La creación del user asociado es un paso separado en el usecase. Si el user creation falla después del commit del empleado, queda un empleado huérfano sin cuenta. Se documenta como deuda técnica — la solución correcta sería una saga o compensating transaction, pero está fuera del scope.

### findAll con COUNT(*) OVER() para paginación

La query de listado usa la ventana `COUNT(*) OVER()` para obtener el total en una sola query en lugar de hacer dos queries (datos + count). Es la forma idiomática en PostgreSQL.

---

## Side-effects manejados

- **migrate.ts**: corregido para cargar todos los archivos .sql en orden, no solo 001.
- **users.employee_id FK**: agregada como `ALTER TABLE` condicional (`DO $ BEGIN IF NOT EXISTS...`) para no fallar si ya existe.
- **ValidationError en errors.ts**: nuevo tipo de error de dominio, necesario para distinguir errores de lógica de negocio (422) de conflictos de datos (409).

---

## Deuda técnica

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | Employee creation no es atómica: si userRepo.create falla post-commit, queda empleado sin cuenta | medio | cuando se implemente una solución de saga o integración con transacciones distribuidas |
| 2 | No hay endpoint GET /employees/export (exportación CSV referenciada en UI) | bajo | hrms-admin o cuando se requiera |
| 3 | Tests de integración de repositorios contra DB real pendientes | medio | antes de ir a producción |

---

## Desviaciones del spec original

| Qué cambió | Motivo | Impacto |
|---|---|---|
| 3 usecases → 1 ManageEmployeesUseCase | Mismas dependencias, no hay valor en archivos separados | bajo — nombre de archivo distinto al spec |
| migrate.ts corregido (no estaba en spec) | Bug encontrado durante implementación | positivo |
| ValidationError agregado a errors.ts | Necesario para 422 vs 409 | bajo — adición aditiva |
