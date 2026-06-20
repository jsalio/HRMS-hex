# Impact Analysis: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación que dispara alta de empleado
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Fecha**: 2026-06-19
**Epicentro del cambio**: Nuevas entidades `JobPosting` y `Candidate` con máquina de estados; use case `hire-candidate` que coordina con `IEmployeeRepository`
**Tipo de cambio**: Aditivo — sin modificación de tablas ni contratos existentes

---

## Resumen ejecutivo

Impacto acotado y predecible. El feature es puramente aditivo: 2 tablas nuevas, ~7 use cases nuevos, 1 repositorio nuevo, 1 controlador nuevo, 1 módulo UI nuevo. El único punto de integración con código existente es el use case `hire-candidate`, que necesita `IEmployeeRepository` para crear el empleado en la misma transacción. El resto del sistema (auth, employees, documents, absences, attendance, benefits) no se modifica. Todos los scaffolds de integración (AppModule.RECRUITMENT, seed CHECK constraint, sidebar, PAGE_TITLES, i18n base) ya existen desde sub-specs anteriores.

---

## Mapa de zonas afectadas

| Archivo / Módulo | Capa | Tipo de cambio | Severidad |
|---|---|---|---|
| `packages/core/src/domain/candidate.ts` | dominio | NUEVO | 🟢 |
| `packages/core/src/contracts/recruitment.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/list-job-postings.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/create-job-posting.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/update-job-posting.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/list-candidates.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/create-candidate.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/advance-candidate-status.usecase.ts` | aplicación | NUEVO | 🟢 |
| `packages/core/src/usecases/hire-candidate.usecase.ts` | aplicación | NUEVO — integración con IEmployeeRepository | 🟡 |
| `packages/core/src/contracts/index.ts` | aplicación | modificado — re-export recruitment | 🟢 |
| `packages/core/src/index.ts` | aplicación | modificado — export domain + usecases | 🟢 |
| `packages/boundary-postgres/src/migrations/007_recruitment.sql` | infraestructura | NUEVO — 2 tablas + seed permisos | 🟡 |
| `packages/boundary-postgres/src/repositories/recruitment.repository.ts` | infraestructura | NUEVO | 🟢 |
| `packages/boundary-postgres/src/index.ts` | infraestructura | modificado — export RecruitmentRepository | 🟢 |
| `packages/api/src/controllers/recruitment.controller.ts` | API | NUEVO | 🟢 |
| `packages/api/src/container.ts` | API | modificado — instanciar RecruitmentRepository + use cases | 🟢 |
| `packages/api/src/index.ts` | API | modificado — registrar rutas /job-postings + /candidates | 🟢 |
| `apps/hrms-ui/src/app/recruitment/` | UI | NUEVO — módulo completo | 🟢 |
| `apps/hrms-ui/src/app/app.routes.ts` | UI | modificado — agregar ruta /recruitment | 🟢 |
| `apps/hrms-ui/src/assets/i18n/{es,en,pt}.json` | UI | modificado — claves recruitment.* | 🟢 |

---

## Side-effects por severidad

### 🔴 Críticos
Ninguno.

### 🟠 Altos
Ninguno.

### 🟡 Medios

- **`hire-candidate` cruza dos agregados**: El use case necesita coordinar `IRecruitmentRepository` (actualizar candidato) y `IEmployeeRepository` (crear empleado + onboarding) en una sola transacción. Si la transacción falla a mitad, podría quedar el empleado creado sin que el candidato actualice a HIRED — o viceversa. **Solución definida**: `IRecruitmentRepository.hire()` encapsula toda la transacción; el repositorio Postgres recibe `IEmployeeRepository` como dependencia o implementa el SQL completo en una sola transacción de BD. Esta decisión se fija en `/arch`.

- **Permisos de `recruitment` no seeded**: `001_auth_roles.sql` ya tiene el módulo en el CHECK constraint y `AppModule.RECRUITMENT` en el enum, pero ningún rol tiene permisos de recruitment. El rol `hr_manager` necesita `{canView: true, canCreate: true, canEdit: true}` para gestionar todo el pipeline incluyendo `hire`. Esto va en `007_recruitment.sql` (INSERT con ON CONFLICT DO NOTHING, como el patrón establecido).

### 🟢 Bajos

- **`shell.component.ts` ya tiene `AppModule.RECRUITMENT` en `ALL_NAV_ITEMS`** y `PAGE_TITLES['/recruitment']` — no requiere modificación.
- **`shell.nav.recruitment` i18n** ya existe en `{es,en,pt}.json` — no requiere modificación.
- **`AppModule.RECRUITMENT` ya está en el enum** `packages/core/src/contracts/roles.ts` y en el CHECK constraint de `001_auth_roles.sql`.
- **`app.routes.ts`** necesita agregar la ruta `/recruitment` — cambio de 1 línea.

---

## Base de datos

- **Migración necesaria**: sí — `007_recruitment.sql`
- **Datos existentes en riesgo**: no — las tablas son nuevas, no hay backfill
- **Detalle**:
  - Crea `job_postings` y `candidates` con FK a `departments(id)` y `employees(id)`
  - `candidates.hired_as_employee_id` es FK nullable a `employees(id)` — no rompe registros existentes de employees
  - Agrega permisos de recruitment al rol `hr_manager` (INSERT ON CONFLICT DO NOTHING — idempotente)
  - Constraint a añadir (SEC-4): `UNIQUE(posting_id, email)` en candidates

---

## Contratos que cambian

Solo adiciones — ningún contrato existente se rompe:

- `packages/core/src/contracts/recruitment.ts` — NUEVO: `IRecruitmentRepository`, tipos `JobPosting`, `Candidate`, `CandidateStatus`
- `packages/core/src/contracts/index.ts` — re-exporta los tipos recruitment
- `packages/core/src/index.ts` — exporta las 7 clases de use case + `Candidate` domain

---

## Puntos ciegos (verificación manual requerida)

- [ ] Confirmar que la transacción de `hire` es atómica en el repositorio Postgres — probar fallo a mitad con rollback explícito
- [ ] Verificar que el `hire` endpoint rechaza a un candidato cuyo `status != 'OFFER'` con 422 (no con 500)
- [ ] Verificar que el candidato contratado (`HIRED`) no puede cambiar de status (invariante 2)
- [ ] Verificar que `unique_candidate_per_posting` genera 409, no 500, en el controlador

---

## Checklist antes de implementar

- [x] `AppModule.RECRUITMENT` existe en el enum
- [x] CHECK constraint incluye `'recruitment'` en `001_auth_roles.sql`
- [x] `ALL_NAV_ITEMS` tiene entrada RECRUITMENT en shell.component.ts
- [x] `PAGE_TITLES['/recruitment']` existe en shell.component.ts
- [x] `shell.nav.recruitment` existe en los 3 archivos i18n
- [ ] Permisos de recruitment para `hr_manager` añadidos en `007_recruitment.sql`
- [ ] Ruta `/recruitment` añadida en `app.routes.ts`
- [ ] Transacción de `hire` diseñada y acordada en `/arch`

---

## Próximo paso

Continuar con `/arch` para definir el patrón de la transacción `hire-candidate` y el mapeo de capas del módulo.
