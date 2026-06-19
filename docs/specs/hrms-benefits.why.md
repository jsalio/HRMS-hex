# Why: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Estado**: Implementado
**Fecha de planificación**: 2026-06-18
**Fecha de implementación**: 2026-06-18

---

## Contexto

### ¿Qué problema resuelve este cambio?

El HRMS gestiona el ciclo completo del empleado pero no tiene ningún mecanismo para administrar los beneficios laborales (seguro médico, dental, pensión, etc.). Las asignaciones de beneficios se llevan en hojas de cálculo externas, lo que genera inconsistencias entre lo que HR tiene registrado y la realidad.

Con este feature, HR puede crear un catálogo de planes de beneficios, asignar empleados a esos planes con fecha de inicio, y dar de baja a empleados cuando corresponde. El empleado puede consultar sus beneficios activos desde el portal.

### ¿Por qué ahora?

Sub-spec 7/10 del proyecto hrms-hex. Los pre-requisitos (employees completo, auth/roles, permisos por módulo) ya están implementados. El `AppModule.BENEFITS` ya estaba declarado en `contracts/roles.ts` y el nav item del sidebar ya existía en `shell.component.ts` — el sistema esperaba este feature.

---

## Decisiones de planificación

### Decisión: Dos componentes Angular separados para admin vs empleado

- **Qué se decidió**: `BenefitsAdminPageComponent` y `MyBenefitsPageComponent` como dos componentes independientes, siguiendo el patrón de `approvals-page` + `my-absences-page` del módulo de ausencias.
- **Por qué**: El spec define explícitamente dos vistas con comportamientos opuestos — la admin tiene operaciones CRUD y modales de inscripción; la de empleado es solo lectura. Mezclarlas en un componente requeriría lógica condicional por rol en el template, dificultando los tests y la mantención.
- **Alternativa descartada**: Un único componente que detecta el rol del usuario y condiciona el render. Descartado porque duplica el `@if (isAdmin)` a lo largo del template y hace los tests más complejos.
- **Consecuencia**: Dos rutas en `app.routes.ts` — `/benefits` (admin) y `/benefits/my` (empleado) — protegidas cada una con su `permissionGuard`.

### Decisión: `assertIsActive()` en la entidad `BenefitPlan`, no en el use case

- **Qué se decidió**: La regla "no se puede inscribir en un plan inactivo" vive en la entidad de dominio como método `assertIsActive()`, que el use case `EnrollBenefitUseCase` llama explícitamente.
- **Por qué**: Es lógica de negocio invariante — no depende de contexto externo. Si estuviera en el use case, una futura operación que también necesite verificar si un plan está activo tendría que duplicar la lógica o importarla de un lugar no natural.
- **Alternativa descartada**: Validar `is_active === true` directamente en `EnrollBenefitUseCase` antes de llamar al repositorio. Más simple en el corto plazo, pero acopla la regla al use case específico.
- **Consecuencia**: La entidad tiene lógica, lo cual es correcto para un domain model rico.

### Decisión: Migración `006_benefits.sql`, no `007_benefits.sql`

- **Qué se decidió**: La migración se numera `006_benefits.sql`.
- **Por qué**: Las migraciones existentes van de 001 a 005 secuencialmente. El spec original decía `007`, dejando un hueco `006` sin justificación. El gap podría confundir al runner de migraciones si algún día se agrega un `006` para otro feature.
- **Alternativa descartada**: Respetar `007` del spec. Descartado porque implicaría planificar un módulo en el número `006` que aún no existe en ningún spec.
- **Consecuencia**: Si payroll (sub-spec 8/10) tiene migración, se numera `007_payroll.sql`.

### Decisión: Ownership verificado en el use case, no solo en el middleware

- **Qué se decidió**: `GetEmployeeBenefitsUseCase` recibe `requestingUserId` y `requestingUserRole` y lanza `ForbiddenError` si el usuario no es el owner ni es HR/super_admin.
- **Por qué**: La invariante #4 del spec ("empleado solo ve los suyos") debe estar enforced en la capa de aplicación, no solo como guard de ruta. Un bug en el permissionGuard dejaría el use case sin protección. Patrón establecido por `CancelAbsenceUseCase` que también verifica ownership. Resuelve hallazgo de seguridad SEC-BEN-2 (IDOR).
- **Alternativa descartada**: Verificar solo en el controller/middleware y dejar el use case sin chequeo de ownership. Descartado por el riesgo IDOR identificado en el análisis de seguridad.
- **Consecuencia**: El controller debe extraer `requestingUserId` del JWT y pasarlo al use case.

### Decisión: `BenefitPlanType` validado en el use case, no solo en Zod del controller

- **Qué se decidió**: `CreateBenefitPlanUseCase` valida que el `type` recibido pertenezca al array de valores válidos (`['health', 'life_insurance', 'dental', 'vision', 'pension', 'other']`) antes de persistir, lanzando `ValidationError` si no cumple.
- **Por qué**: Resuelve hallazgo SEC-BEN-3. Si solo Zod valida en el controller, un error de tipo en DB devolvería el nombre del constraint de PostgreSQL al cliente. La validación en el use case garantiza un mensaje limpio y consistente independientemente de cómo se llame al use case (HTTP o tests directos).
- **Alternativa descartada**: Depender solo del `CHECK` constraint en PostgreSQL. Expone detalles internos del schema en el mensaje de error.
- **Consecuencia**: El type `BenefitPlanType` como union literal debe importarse tanto en el dominio como en el use case.

---

## Desviaciones del spec

| Elemento del spec | Lo planeado | Lo implementado | Motivo |
|---|---|---|---|
| Tests controller — `plan_id` en body | UUID real en doc | `PLAN_UUID = '00000000-...'` en fixture | La validación Zod del endpoint rechaza strings no-UUID; los tests usaban `'p-1'` que no cumple el formato |

> ⚠️ Desviación menor detectada durante implementación: Los tests del controller usaban `plan_id: 'p-1'` pero el schema Zod valida UUID. Se corrigió a UUID válido en los fixtures. No impacta contratos de API.

---

## Deuda técnica generada durante planning

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | Ruta `/documents` ausente en `app.routes.ts` (preexistente, no causada por este feature) | bajo — navegación directa a /documents no funciona | antes de go-live |
| 2 | No existe `ForbiddenError` en `packages/core/src/domain/errors.ts` — `GetEmployeeBenefitsUseCase` necesitará lanzar un error específico para 403 vs 404 | medio — sin ForbiddenError se lanzaría un `ValidationError` genérico que el controller mapearía mal | durante `/implement` |

---

## Archivos que se crearán / modificarán

| Archivo | Tipo de cambio | Motivo |
|---|---|---|
| `packages/core/src/domain/benefit-plan.ts` | NUEVO | Entidad BenefitPlan + BenefitPlanType + DTOs |
| `packages/core/src/contracts/benefits.ts` | NUEVO | 9 capacidades atómicas + IBenefitRepository + tipos compuestos |
| `packages/core/src/contracts/index.ts` | modificado | Re-export de contracts/benefits.ts |
| `packages/core/src/index.ts` | modificado | Re-export de los 6 use cases y BenefitPlan |
| `packages/core/src/usecases/list-benefit-plans.usecase.ts` | NUEVO | |
| `packages/core/src/usecases/create-benefit-plan.usecase.ts` | NUEVO | |
| `packages/core/src/usecases/update-benefit-plan.usecase.ts` | NUEVO | |
| `packages/core/src/usecases/get-employee-benefits.usecase.ts` | NUEVO | Incluye check de ownership |
| `packages/core/src/usecases/enroll-benefit.usecase.ts` | NUEVO | Llama assertIsActive() + verifica duplicado |
| `packages/core/src/usecases/unenroll-benefit.usecase.ts` | NUEVO | |
| `packages/boundary-postgres/src/migrations/006_benefits.sql` | NUEVO | Tablas benefit_plans + employee_benefits |
| `packages/boundary-postgres/src/repositories/benefit.repository.ts` | NUEVO | BenefitRepository implements IBenefitRepository |
| `packages/boundary-postgres/src/index.ts` | modificado | Re-export BenefitRepository |
| `packages/api/src/controllers/benefits.controller.ts` | NUEVO | 6 rutas: 3 /benefit-plans + 3 /employees/:id/benefits |
| `packages/api/src/container.ts` | modificado | Instanciar benefitRepo + 6 use cases |
| `packages/api/src/index.ts` | modificado | Montar rutas de benefits |
| `apps/hrms-ui/src/app/benefits/benefits.service.ts` | NUEVO | HTTP client |
| `apps/hrms-ui/src/app/benefits/benefits-admin-page.component.ts` | NUEVO | Vista HR |
| `apps/hrms-ui/src/app/benefits/my-benefits-page.component.ts` | NUEVO | Vista empleado |
| `apps/hrms-ui/src/app/app.routes.ts` | modificado | Añadir rutas /benefits y /benefits/my |
| `apps/hrms-ui/src/assets/i18n/es.json` | modificado | Claves benefits.* |
| `apps/hrms-ui/src/assets/i18n/en.json` | modificado | Claves benefits.* |
| `apps/hrms-ui/src/assets/i18n/pt.json` | modificado | Claves benefits.* |
| `packages/core-tests/src/domain/benefit-plan.test.ts` | NUEVO | 3 tests de dominio |
| `packages/core-tests/src/usecases/list-benefit-plans.usecase.test.ts` | NUEVO | |
| `packages/core-tests/src/usecases/create-benefit-plan.usecase.test.ts` | NUEVO | |
| `packages/core-tests/src/usecases/update-benefit-plan.usecase.test.ts` | NUEVO | |
| `packages/core-tests/src/usecases/get-employee-benefits.usecase.test.ts` | NUEVO | |
| `packages/core-tests/src/usecases/enroll-benefit.usecase.test.ts` | NUEVO | |
| `packages/core-tests/src/usecases/unenroll-benefit.usecase.test.ts` | NUEVO | |
| `packages/api/src/__tests__/benefits.controller.test.ts` | NUEVO | 13 tests HTTP |
| `apps/hrms-ui/src/app/benefits/benefits-admin-page.component.spec.ts` | NUEVO | 9 tests |
| `apps/hrms-ui/src/app/benefits/my-benefits-page.component.spec.ts` | NUEVO | 7 tests |
| `apps/hrms-ui/src/app/benefits/benefits.service.spec.ts` | NUEVO | 2 tests |

---

## Mensaje de commit (borrador — completar tras implementación)

```
feat(benefits): implementar módulo de planes de beneficios

Sub-spec 7/10 del proyecto hrms-hex. Permite a HR crear y gestionar
planes de beneficios (salud, dental, vida, etc.) y asignar empleados.
El empleado puede consultar sus beneficios activos de forma read-only.

Se añade ForbiddenError al dominio para distinguir 403 de 422 en el
check de ownership de GET /employees/:id/benefits (anti-IDOR).
Migración 006_benefits.sql (el spec indicaba 007 — corregido a secuencial).

TODO: resolver ruta /documents ausente en app.routes.ts (deuda preexistente)
```

---

## Referencias

- Spec: `docs/specs/hrms-benefits.spec.md`
- Security: `docs/specs/hrms-benefits.security.md`
- Impact: `docs/specs/hrms-benefits.impact.md`
- Arch: `docs/specs/hrms-benefits.arch.md`
- TDD Plan backend: `docs/specs/hrms-benefits.tdd-plan.md`
- TDD Plan UI: `docs/specs/hrms-benefits.tdd-plan-ui.md`
