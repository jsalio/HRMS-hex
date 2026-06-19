# TDD Plan: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Arch de origen**: docs/specs/hrms-benefits.arch.md
**Fecha**: 2026-06-18
**Total de tests planificados**: 29

---

## Resumen

| Capa | Tipo | Archivo | Tests |
|---|---|---|---|
| Dominio | Unitario | `core-tests/domain/benefit-plan.test.ts` | 3 |
| Aplicación | Unitario con mocks | `core-tests/usecases/list-benefit-plans.usecase.test.ts` | 1 |
| Aplicación | Unitario con mocks | `core-tests/usecases/create-benefit-plan.usecase.test.ts` | 2 |
| Aplicación | Unitario con mocks | `core-tests/usecases/update-benefit-plan.usecase.test.ts` | 2 |
| Aplicación | Unitario con mocks | `core-tests/usecases/get-employee-benefits.usecase.test.ts` | 3 |
| Aplicación | Unitario con mocks | `core-tests/usecases/enroll-benefit.usecase.test.ts` | 3 |
| Aplicación | Unitario con mocks | `core-tests/usecases/unenroll-benefit.usecase.test.ts` | 2 |
| Presentación | Integración HTTP | `api/__tests__/benefits.controller.test.ts` | 13 |
| **Total** | | | **29** |

> **Infraestructura (BenefitRepository)**: no se planifican tests unitarios del repo aislado. El patrón del proyecto valida los repositorios vía tests de integración HTTP del controller, que ejercen el use case real.

---

## Cobertura de invariantes

| # | Invariante del spec | Test asignado |
|---|---|---|
| 1 | No se puede inscribir en plan inactivo | `given_inactive_plan_when_enroll_then_throws_ValidationError` |
| 2 | No se puede inscribir dos veces en el mismo plan activo | `given_active_enrollment_when_enroll_again_then_throws_ConflictError` |
| 3 | Empleado INACTIVE puede ver beneficios históricos (solo lectura) | `given_hr_manager_when_GET_employee_benefits_then_returns_200` *(cobertura vía permisos)* |
| 4 | Empleado solo ve sus propios beneficios; HR ve todos | `given_non_owner_employee_when_get_employee_benefits_then_throws_ForbiddenError` + `given_hr_manager_role_when_get_employee_benefits_then_returns_results` |
| 5 | Solo `can_edit` puede dar de baja | `given_employee_without_edit_permission_when_DELETE_then_returns_403` |
| 6 | `type` validado en dominio antes de DB | `given_valid_type_when_instantiate_BenefitPlan_then_no_error` + `given_invalid_type_when_create_plan_then_throws_ValidationError` |

---

## Secuencia de implementación

### Iteración 1 — Dominio

Archivo: `packages/core-tests/src/domain/benefit-plan.test.ts`

#### Test 1.1
- **Nombre**: `given_active_plan_when_assertIsActive_then_does_not_throw`
- **Tipo**: unitario
- **Arrange**: `new BenefitPlan({ id: 'p1', name: 'Health Plan', type: 'health', isActive: true, ... })`
- **Act**: `plan.assertIsActive()`
- **Assert**: no lanza ninguna excepción
- **Implementación mínima para GREEN**: crear clase `BenefitPlan` con `assertIsActive()` que no hace nada cuando `isActive === true`

#### Test 1.2
- **Nombre**: `given_inactive_plan_when_assertIsActive_then_throws_ValidationError`
- **Tipo**: unitario
- **Arrange**: `new BenefitPlan({ ..., isActive: false })`
- **Act**: `plan.assertIsActive()`
- **Assert**: lanza `ValidationError` con mensaje que indica plan inactivo
- **Implementación mínima para GREEN**: añadir `if (!this.data.isActive) throw new ValidationError(...)` en `assertIsActive()`
- **Cubre invariante**: #1

#### Test 1.3
- **Nombre**: `given_invalid_type_when_instantiate_BenefitPlan_then_does_not_throw_at_domain_level`
- **Tipo**: unitario
- **Arrange**: `new BenefitPlan({ ..., type: 'health' as BenefitPlanType })`
- **Act**: instanciar la entidad con tipo válido
- **Assert**: no lanza
- **Nota**: `BenefitPlanType` es `'health' | 'life_insurance' | 'dental' | 'vision' | 'pension' | 'other'`. La validación del string en tiempo de ejecución ocurre en el use case (ver Test 2.4). Este test confirma que el dominio acepta correctamente los valores del enum.
- **Implementación mínima para GREEN**: tipo `BenefitPlanType` declarado como union literal

---

### Iteración 2 — Casos de uso

#### Test 2.1 — ListBenefitPlansUseCase
Archivo: `packages/core-tests/src/usecases/list-benefit-plans.usecase.test.ts`

- **Nombre**: `given_existing_plans_when_execute_then_returns_all_plans`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findAll` que retorna `[plan1, plan2]`
- **Act**: `useCase.execute()`
- **Assert**: resultado es array con 2 planes
- **Mocks**: `IFindBenefitPlans` con `findAll`
- **Implementación mínima para GREEN**: `ListBenefitPlansUseCase.execute()` llama `repo.findAll()` y retorna el resultado

#### Test 2.2 — CreateBenefitPlanUseCase (happy path)
Archivo: `packages/core-tests/src/usecases/create-benefit-plan.usecase.test.ts`

- **Nombre**: `given_unique_name_when_create_then_returns_created_plan`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findByName → null`, `create → planData`
- **Act**: `useCase.execute({ name: 'Health', type: 'health' })`
- **Assert**: resultado tiene `id` y `name === 'Health'`
- **Mocks**: `CreateBenefitPlanRepository` (`findByName` + `create`)

#### Test 2.3 — CreateBenefitPlanUseCase (duplicado)
- **Nombre**: `given_duplicate_name_when_create_then_throws_ConflictError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findByName → existingPlan`
- **Act**: `useCase.execute({ name: 'Health', type: 'health' })`
- **Assert**: lanza `ConflictError`
- **Mocks**: `findByName` retorna plan existente

#### Test 2.4 — CreateBenefitPlanUseCase (type inválido)
- **Nombre**: `given_invalid_type_when_create_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock básico
- **Act**: `useCase.execute({ name: 'Health', type: 'invalid_type' as any })`
- **Assert**: lanza `ValidationError`
- **Cubre invariante**: #6
- **Implementación mínima para GREEN**: validar `type` contra el array de valores válidos antes de persistir

> _Este test entra en la segunda prioridad si el type se valida vía Zod en el controller. Se incluye aquí porque el arch doc especifica que la validación debe ocurrir en dominio/use case. Ver decisión arquitectónica #2 del arch doc._

#### Test 2.5 — UpdateBenefitPlanUseCase (happy path)
Archivo: `packages/core-tests/src/usecases/update-benefit-plan.usecase.test.ts`

- **Nombre**: `given_existing_plan_when_update_then_returns_updated_plan`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findById → plan`, `update → updatedPlan`
- **Act**: `useCase.execute({ id: 'p1', isActive: false })`
- **Assert**: resultado tiene `isActive === false`
- **Mocks**: `UpdateBenefitPlanRepository` (`findById` + `update`)

#### Test 2.6 — UpdateBenefitPlanUseCase (no encontrado)
- **Nombre**: `given_unknown_plan_id_when_update_then_throws_NotFoundError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findById → null`
- **Act**: `useCase.execute({ id: 'nonexistent' })`
- **Assert**: lanza `NotFoundError`

#### Test 2.7 — GetEmployeeBenefitsUseCase (owner)
Archivo: `packages/core-tests/src/usecases/get-employee-benefits.usecase.test.ts`

- **Nombre**: `given_owner_employee_when_get_own_benefits_then_returns_results`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findByEmployee → [enrollment]`; `requestingUserId === employeeId`
- **Act**: `useCase.execute({ employeeId: 'e1', requestingUserId: 'e1', requestingUserRole: 'employee' })`
- **Assert**: retorna array con la inscripción
- **Mocks**: `GetEmployeeBenefitsRepository` (`findByEmployee`)

#### Test 2.8 — GetEmployeeBenefitsUseCase (HR manager)
- **Nombre**: `given_hr_manager_role_when_get_employee_benefits_then_returns_results`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findByEmployee → [enrollment]`; requestingUserId diferente al employeeId pero rol `hr_manager`
- **Act**: `useCase.execute({ employeeId: 'e1', requestingUserId: 'e2', requestingUserRole: 'hr_manager' })`
- **Assert**: retorna array con la inscripción
- **Cubre invariante**: #4

#### Test 2.9 — GetEmployeeBenefitsUseCase (IDOR guard)
- **Nombre**: `given_non_owner_employee_when_get_employee_benefits_then_throws_ForbiddenError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock; `requestingUserId !== employeeId` y rol `employee`
- **Act**: `useCase.execute({ employeeId: 'e1', requestingUserId: 'e2', requestingUserRole: 'employee' })`
- **Assert**: lanza `ForbiddenError` (o `ValidationError` si no existe ForbiddenError en el proyecto)
- **Cubre invariante**: #4 — previene IDOR (SEC-BEN-2)

#### Test 2.10 — EnrollBenefitUseCase (happy path)
Archivo: `packages/core-tests/src/usecases/enroll-benefit.usecase.test.ts`

- **Nombre**: `given_active_plan_and_no_existing_enrollment_when_enroll_then_creates_enrollment`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findById → activePlan`, `findEnrollment → null`, `enroll → enrollmentData`
- **Act**: `useCase.execute({ employeeId: 'e1', planId: 'p1', enrolledAt: '2026-01-01' })`
- **Assert**: retorna datos de inscripción con `planId === 'p1'`
- **Mocks**: `EnrollBenefitRepository`

#### Test 2.11 — EnrollBenefitUseCase (plan inactivo)
- **Nombre**: `given_inactive_plan_when_enroll_then_throws_ValidationError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findById → inactivePlan (isActive: false)`
- **Act**: `useCase.execute({ employeeId: 'e1', planId: 'p1', enrolledAt: '2026-01-01' })`
- **Assert**: lanza `ValidationError`
- **Cubre invariante**: #1

#### Test 2.12 — EnrollBenefitUseCase (duplicado activo)
- **Nombre**: `given_active_enrollment_already_exists_when_enroll_then_throws_ConflictError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findById → activePlan`, `findEnrollment → existingEnrollment (unenrolledAt: null)`
- **Act**: `useCase.execute({ employeeId: 'e1', planId: 'p1', enrolledAt: '2026-06-01' })`
- **Assert**: lanza `ConflictError`
- **Cubre invariante**: #2

#### Test 2.13 — UnenrollBenefitUseCase (happy path)
Archivo: `packages/core-tests/src/usecases/unenroll-benefit.usecase.test.ts`

- **Nombre**: `given_existing_enrollment_when_unenroll_then_returns_enrollment_with_unenrolled_at`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findEnrollment → enrollment (unenrolledAt: null)`, `unenroll → enrollmentWithDate`
- **Act**: `useCase.execute({ employeeId: 'e1', planId: 'p1', unenrolledAt: '2026-06-18' })`
- **Assert**: resultado tiene `unenrolledAt === '2026-06-18'`
- **Mocks**: `UnenrollBenefitRepository`

#### Test 2.14 — UnenrollBenefitUseCase (no inscrito)
- **Nombre**: `given_no_enrollment_found_when_unenroll_then_throws_NotFoundError`
- **Tipo**: unitario con mock
- **Arrange**: repo mock con `findEnrollment → null`
- **Act**: `useCase.execute({ employeeId: 'e1', planId: 'p1', unenrolledAt: '2026-06-18' })`
- **Assert**: lanza `NotFoundError`

---

### Iteración 3 — Presentación (integración HTTP)

Archivo: `packages/api/src/__tests__/benefits.controller.test.ts`

Patrón: mock los use cases, no el repositorio. Igual que `roles.controller.test.ts`.

#### Test 3.1
- **Nombre**: `given_user_with_benefits_view_permission_when_GET_benefit_plans_then_returns_200`
- **Act**: `GET /benefit-plans` con token `canView: true` en `AppModule.BENEFITS`
- **Assert**: status 200, body es array

#### Test 3.2
- **Nombre**: `given_user_without_benefits_view_permission_when_GET_benefit_plans_then_returns_403`
- **Act**: `GET /benefit-plans` con token `canView: false` en `AppModule.BENEFITS`
- **Assert**: status 403
- **Cubre invariante**: #5 indirectamente

#### Test 3.3
- **Nombre**: `given_valid_plan_data_when_POST_benefit_plans_then_returns_201`
- **Act**: `POST /benefit-plans` con body `{ name, type: 'health' }`, token `canCreate: true`
- **Assert**: status 201, body tiene `id`

#### Test 3.4
- **Nombre**: `given_employee_role_when_POST_benefit_plans_then_returns_403`
- **Act**: `POST /benefit-plans` con token `canCreate: false`
- **Assert**: status 403

#### Test 3.5
- **Nombre**: `given_duplicate_name_when_POST_benefit_plans_then_returns_409`
- **Act**: `POST /benefit-plans`, use case mock lanza `ConflictError`
- **Assert**: status 409

#### Test 3.6
- **Nombre**: `given_existing_plan_when_PATCH_benefit_plans_id_then_returns_200`
- **Act**: `PATCH /benefit-plans/p1` con body `{ isActive: false }`, token `canEdit: true`
- **Assert**: status 200, body tiene `isActive: false`

#### Test 3.7
- **Nombre**: `given_unknown_plan_when_PATCH_benefit_plans_id_then_returns_404`
- **Act**: `PATCH /benefit-plans/unknown`, use case mock lanza `NotFoundError`
- **Assert**: status 404

#### Test 3.8
- **Nombre**: `given_owner_employee_when_GET_employees_id_benefits_then_returns_200`
- **Act**: `GET /employees/e1/benefits`, token `sub: 'e1'`, `canView: true`
- **Assert**: status 200, body es array
- **Cubre invariante**: #4

#### Test 3.9
- **Nombre**: `given_non_owner_employee_when_GET_employees_id_benefits_then_returns_403`
- **Act**: `GET /employees/e2/benefits`, token `sub: 'e1'` (diferente), `canView: true`, rol `employee`
- **Assert**: status 403 — el use case mock lanza `ForbiddenError`
- **Cubre invariante**: #4 (anti-IDOR)

#### Test 3.10
- **Nombre**: `given_valid_enrollment_when_POST_employees_id_benefits_then_returns_201`
- **Act**: `POST /employees/e1/benefits` con body `{ plan_id, enrolled_at }`, token `canCreate: true`
- **Assert**: status 201

#### Test 3.11
- **Nombre**: `given_inactive_plan_when_POST_employees_id_benefits_then_returns_422`
- **Act**: `POST /employees/e1/benefits`, use case mock lanza `ValidationError`
- **Assert**: status 422
- **Cubre invariante**: #1

#### Test 3.12
- **Nombre**: `given_already_enrolled_when_POST_employees_id_benefits_then_returns_409`
- **Act**: `POST /employees/e1/benefits`, use case mock lanza `ConflictError`
- **Assert**: status 409
- **Cubre invariante**: #2

#### Test 3.13
- **Nombre**: `given_existing_enrollment_when_DELETE_employees_id_benefits_planId_then_returns_200_with_unenrolled_at`
- **Act**: `DELETE /employees/e1/benefits/p1`, token `canEdit: true`
- **Assert**: status 200, body tiene `unenrolledAt` no nulo
- **Cubre invariante**: #5

---

## Tests de segunda prioridad

- `given_inactive_plan_type_invalid_string_when_create_then_returns_422_from_controller` — cubierto por Zod en el controller; el test 2.4 ya verifica la capa de use case. Añadir un test de controller 422 solo si el equipo quiere cobertura explícita en presentación.
- `given_employee_with_no_benefits_when_GET_then_returns_empty_array` — comportamiento trivial, no modela un invariante. Útil en QA manual.
- `given_deleted_employee_when_enroll_then_throws_NotFoundError` — no está en el spec, fuera de scope v1.

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| `BenefitRepository.findAll()` unitario | El patrón del proyecto no testea repositorios en aislamiento — se cubren vía tests HTTP. |
| `BenefitRepository.enroll()` unitario | Mismo motivo. La migración 006_benefits.sql cubre el schema. |
| `GET /benefit-plans` sin token | El middleware de auth rechaza sin token con 401 — comportamiento global ya cubierto por `auth.controller.test.ts`. |
| `PATCH /benefit-plans/:id` con `type` inválido | Cubierto por la validación Zod del controller (retorna 422 automáticamente). |

---

## Próximo paso

Continuar con `/tdd-plan-ui` para planificar los tests de los componentes Angular.
