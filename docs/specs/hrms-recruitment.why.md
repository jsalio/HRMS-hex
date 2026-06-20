# Why: hrms-recruitment

**Feature**: Pipeline de reclutamiento — vacantes, candidatos y contratación que dispara alta de empleado
**Spec de origen**: docs/specs/hrms-recruitment.spec.md
**Fecha de implementación**: 2026-06-19
**Estado**: BORRADOR — se completa después de /implement

---

## Contexto

### ¿Qué problema resuelve este cambio?

El sistema HRMS no tenía forma de gestionar el ingreso de nuevos empleados desde antes de que existan como tales. El módulo de empleados asumía que alguien externo al sistema ya había seleccionado y contratado a la persona. Esto obligaba a los equipos de RRHH a usar herramientas externas (hojas de cálculo, correos) para rastrear candidatos y luego ingresar manualmente los datos del contratado al sistema.

Con este módulo, el ciclo de vida de un empleado empieza desde la vacante: se publica la posición, se reciben candidatos, avanzan por el pipeline (APPLIED → SCREENING → INTERVIEW → OFFER → HIRED), y al momento de contratar, el sistema crea automáticamente el expediente del empleado e inicia su onboarding. Todo en una sola transacción.

### ¿Por qué ahora?

Sub-spec 8 del plan de 10 módulos del sistema HRMS. Las dependencias previas (employees, departments) están completas. Es el momento natural del pipeline.

---

## Decisiones de planificación

### Decisión: `IRecruitmentRepository.hire()` encapsula la transacción completa

- **Qué se decidió**: El use case `HireCandidateUseCase` valida las reglas de negocio (candidato en OFFER, salary > 0, etc.) y luego llama a un único método `repo.hire()` que ejecuta en una sola transacción SQL: INSERT employee, INSERT onboarding steps, INSERT user account, UPDATE candidate → HIRED.
- **Por qué**: Mantener la atomicidad sin filtrar conceptos de infraestructura (transacciones) al use case. El patrón ya está establecido en `EmployeeRepository.create()` que también maneja employee + onboarding en un solo `BEGIN/COMMIT`.
- **Alternativa descartada**: Llamar a `employeeRepo.create()` y `recruitmentRepo.updateStatus()` por separado desde el use case → no atómico; si falla el segundo paso queda un empleado sin candidato asociado.
- **Consecuencia**: `RecruitmentRepository.hire()` tiene más responsabilidad que un repositorio típico, pero la alternativa (unidad de trabajo / Unit of Work pattern) añade complejidad innecesaria para este caso.

### Decisión: Máquina de estados en la entidad de dominio `Candidate`

- **Qué se decidió**: La tabla de transiciones válidas vive en `packages/core/src/domain/candidate.ts` como constante `CANDIDATE_TRANSITIONS` y la validación la hace `candidate.assertCanTransitionTo(next)`.
- **Por qué**: Las reglas de transición son lógica de dominio pura — no dependen de infraestructura. Moverlas al dominio permite testearlas sin mocks, sin BD, sin HTTP.
- **Alternativa descartada**: Validar las transiciones directamente en el use case o en el repositorio → lógica de negocio en la capa incorrecta.

### Decisión: Constraint `UNIQUE(posting_id, email)` en candidates

- **Qué se decidió**: Añadir `CONSTRAINT unique_candidate_per_posting UNIQUE (posting_id, email)` en la migración 007_recruitment.sql (hallazgo SEC-4 del análisis de seguridad).
- **Por qué**: Sin el constraint, un script o bug puede insertar múltiples candidatos con el mismo email para la misma vacante, generando ruido en el pipeline sin valor.
- **Alternativa descartada**: Solo validar en el use case (sin constraint de BD) → la base de datos queda desprotegida si alguien escribe SQL directamente.

### Decisión: Migración 007 incluye seed de permisos de recruitment para hr_manager

- **Qué se decidió**: `007_recruitment.sql` inserta permisos `{canView, canCreate, canEdit}` para el rol `hr_manager` con `ON CONFLICT DO NOTHING` (idempotente).
- **Por qué**: `001_auth_roles.sql` ya tiene el módulo `recruitment` en el CHECK constraint, pero ningún rol tenía permisos asignados. Sin este seed, ningún usuario (salvo super_admin) podría usar el módulo.
- **Alternativa descartada**: Modificar `001_auth_roles.sql` directamente → rompe entornos donde esa migración ya corrió (no se vuelve a ejecutar).

---

## Decisiones de implementación

### Decisión: `get-candidate.usecase.ts` — 8.º use case no contemplado en el spec

- **Qué se decidió**: Se agregó `GetCandidateUseCase` como caso de uso adicional (no estaba en los 7 del spec).
- **Por qué**: `CandidateProfilePageComponent` necesita cargar un candidato por ID. Sin este use case, el controlador no puede exponer `GET /candidates/:id` y la UI no puede mostrar el perfil individual.
- **Alternativa descartada**: Leer el candidato como parte de la lista filtrada por ID → no semántico; el spec reserva `listCandidates` para un postingId, no para lookup por candidateId.
- **Impacto**: bajo — sigue el mismo patrón que `get-document.usecase.ts` y `get-employee.usecase.ts`.

### Decisión: Password `'RESET_REQUIRED'` para usuarios creados por hire()

- **Qué se decidió**: El campo `password_hash` del usuario creado en la transacción de contratación se almacena como el literal `'RESET_REQUIRED'`.
- **Por qué**: La capa `boundary-postgres` no tiene acceso a `BunPasswordService` (adaptador HTTP). Generar un hash real requeriría acoplar infraestructura de seguridad al repositorio de persistencia. El literal `'RESET_REQUIRED'` es una cadena que bcrypt nunca puede producir, lo que garantiza que el usuario no pueda autenticarse hasta que un administrador le asigne una contraseña real.
- **Alternativa descartada**: Pasar el password hasheado como parámetro al use case → obliga al llamador a manejar criptografía fuera del alcance del pipeline de contratación.
- **Consecuencia**: deuda técnica — se necesita un flujo de "primera contraseña" (password reset) para el empleado recién contratado antes de usar el sistema.

### Decisión: `role_id` del empleado contratado se resuelve con un SELECT inline en hire()

- **Qué se decidió**: Dentro de la transacción `hire()`, se ejecuta `SELECT id FROM roles WHERE name = 'employee' LIMIT 1` para obtener el `role_id` del nuevo usuario.
- **Por qué**: El repositorio no recibe el `role_id` como parámetro (el use case no conoce IDs de roles internos). Resolver el rol por nombre dentro de la transacción es simple e idempotente.
- **Alternativa descartada**: Pasar el `role_id` como parámetro desde el use case → el use case tendría que saber sobre roles de sistema, lo que viola la separación de capas.

### Decisión: Formulario de hire usa inputs de texto para `departmentId` y `documentId` (v1)

- **Qué se decidió**: `HireFormPageComponent` no tiene selectors/dropdowns para departamento; el usuario ingresa el UUID directamente.
- **Por qué**: No existe un `DepartmentsService` ni un `DocumentsService` en la UI del módulo de reclutamiento en v1. Agregar una dependencia cruzada a módulos externos (employees/documents) para poblar un selector queda fuera del alcance del sub-spec 4.
- **Alternativa descartada**: Autocompletar de departamentos con llamada a `/departments` → requiere implementar el service y el UX completo (typeahead/select); scope creep.
- **Consecuencia**: deuda UX documentada en la tabla de deuda técnica.

---

## Registro de implementación

**Fecha de implementación**: 2026-06-19
**Sub-specs completados**: 4 de 4

### Desviaciones del spec

| Sub-spec | Desviación | Motivo | Impacto |
|---|---|---|---|
| 1 — Core | `GetCandidateUseCase` agregado como 8.º use case | UI necesita GET /candidates/:id para el perfil de candidato | bajo |
| 2 — Infra | `password_hash = 'RESET_REQUIRED'` en hire() | BunPasswordService no disponible en boundary-postgres | medio (requiere flujo de reset) |
| 2 — Infra | `role_id` resuelto con SELECT inline en hire() | Use case no conoce IDs de roles del sistema | bajo |
| 4 — UI | Inputs de texto para `departmentId` y `documentId` en HireFormPage | Sin DepartmentsService ni DocumentsService en el módulo | bajo (UX degradada) |

---

## Desviaciones del spec

Registradas en la tabla de **Registro de implementación** arriba.

---

## Deuda técnica generada

| # | Descripción | Impacto | Prioridad para resolver |
|---|---|---|---|
| 1 | `resume_url` se almacena sin validación de esquema HTTPS en el repo Postgres | Medio — SEC-2 — permite URLs arbitrarias en la BD | Antes de producción |
| 2 | No hay rate limiting en `POST /candidates` | Medio — SEC-4 reducido con UNIQUE constraint, pero sin límite de IP | Cuando escale |
| 3 | El modal de confirmación para avanzar/rechazar candidato no está en el spec v1 | Bajo — UX degradada al rechazar sin confirmación | Próximo sprint |

---

## Archivos a crear / modificar

| Archivo | Tipo de cambio | Motivo |
|---|---|---|
| `packages/core/src/domain/candidate.ts` | NUEVO | Entidad Candidate con máquina de estados |
| `packages/core/src/contracts/recruitment.ts` | NUEVO | Puerto IRecruitmentRepository + tipos |
| `packages/core/src/contracts/index.ts` | modificado | Re-export de tipos recruitment |
| `packages/core/src/index.ts` | modificado | Export de use cases + domain |
| `packages/core/src/usecases/list-job-postings.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/create-job-posting.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/update-job-posting.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/list-candidates.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/create-candidate.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/advance-candidate-status.usecase.ts` | NUEVO | — |
| `packages/core/src/usecases/hire-candidate.usecase.ts` | NUEVO | Coordina con repo.hire() atómico |
| `packages/boundary-postgres/src/migrations/007_recruitment.sql` | NUEVO | Tablas + seed permisos hr_manager |
| `packages/boundary-postgres/src/repositories/recruitment.repository.ts` | NUEVO | hire() con sql.begin() transaction |
| `packages/boundary-postgres/src/index.ts` | modificado | Export RecruitmentRepository |
| `packages/api/src/controllers/recruitment.controller.ts` | NUEVO | Rutas /job-postings + /candidates |
| `packages/api/src/container.ts` | modificado | Instanciar repo + use cases |
| `packages/api/src/index.ts` | modificado | Registrar rutas |
| `packages/core-tests/src/domain/candidate.test.ts` | NUEVO | 9 tests de dominio |
| `packages/core-tests/src/usecases/` | NUEVO (7 archivos) | 16 tests de use cases |
| `packages/api/src/__tests__/recruitment.controller.test.ts` | NUEVO | 12 tests HTTP |
| `apps/hrms-ui/src/app/recruitment/` | NUEVO (módulo completo) | 4 Smart + 1 Dumb + service + routes |
| `apps/hrms-ui/src/app/app.routes.ts` | modificado | Agregar ruta /recruitment |
| `apps/hrms-ui/src/assets/i18n/{es,en,pt}.json` | modificado | Claves recruitment.* |

---

## Referencias

- Spec: `docs/specs/hrms-recruitment.spec.md`
- Impact: `docs/specs/hrms-recruitment.impact.md`
- Arch: `docs/specs/hrms-recruitment.arch.md`
- TDD Plan backend: `docs/specs/hrms-recruitment.tdd-plan.md`
- TDD Plan UI: `docs/specs/hrms-recruitment.tdd-plan-ui.md`
- Security: `docs/specs/hrms-recruitment.security.md`

---

## Mensaje de commit (se usa después de /implement)

```
feat(recruitment): implement hrms-recruitment sub-spec (sub-spec 8/10)

Adds a full recruitment pipeline: job postings, candidate tracking
(APPLIED → SCREENING → INTERVIEW → OFFER → HIRED|REJECTED), and a hire
flow that atomically creates the employee record, user account, and
onboarding steps in a single DB transaction.

- Core: Candidate domain entity with state machine, IRecruitmentRepository
  port, 7 use cases
- boundary-postgres: migration 007 (job_postings + candidates tables,
  UNIQUE candidate-per-posting, hr_manager permissions seed),
  RecruitmentRepository with hire() transaction
- api: recruitment controller (/job-postings + /candidates routes)
- hrms-ui: recruitment module (4 Smart components + pipeline stepper)

SEC-4: UNIQUE(posting_id, email) constraint on candidates
TODO: add rate limiting on POST /candidates
TODO: add resume_url HTTPS validation before production
```
