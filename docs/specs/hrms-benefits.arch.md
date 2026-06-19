# Architecture Decision: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Fecha**: 2026-06-18
**Modo**: Detección — proyecto existente
**Patrón arquitectónico**: Hexagonal (Ports & Adapters)

---

## Patrón detectado

### Descripción

El proyecto aplica hexagonal de forma consistente en los sub-specs 1–5. El hexágono puro (`packages/core`) no tiene dependencias externas — contiene dominio, contratos (puertos) y use cases. Los adaptadores (`boundary-postgres`, `api`, `hrms-ui`) implementan o consumen los puertos. Los use cases son atómicos (un archivo, un método `execute`) siguiendo ADR-0001.

### Estructura de capas

```
packages/core/src/
├── domain/           — entidades con invariantes
├── contracts/        — puertos (interfaces) + tipos compartidos
└── usecases/         — un archivo por caso de uso, un método execute()

packages/boundary-postgres/src/
└── repositories/     — implementaciones de IBenefitRepository

packages/api/src/
├── controllers/      — handlers HTTP, sin lógica de negocio
└── container.ts      — composición de dependencias (DI manual)

apps/hrms-ui/src/app/benefits/
├── benefits.service.ts     — HTTP client
├── benefits-admin-page.component.ts  — vista HR (gestión de planes + inscripciones)
└── my-benefits-page.component.ts     — vista empleado (solo lectura)
```

### Regla de dependencias

```
api → core (contratos + use cases)
boundary-postgres → core (implementa contratos)
hrms-ui → api (HTTP)
core → nada externo
```

---

## Mapeo del feature a la arquitectura

| Elemento del spec | Capa | Archivo | Responsabilidad |
|---|---|---|---|
| `benefit_plans` + `employee_benefits` | dominio | `core/domain/benefit-plan.ts` | Entidad `BenefitPlan` con `assertIsActive()`; tipo `EmployeeBenefit` |
| Tipo `BenefitPlanType` enum | contratos | `core/contracts/benefits.ts` | Validación en dominio antes de DB |
| Puerto `IBenefitRepository` | contratos | `core/contracts/benefits.ts` | 12 capacidades atómicas + puerto completo |
| `GET /benefit-plans` | aplicación | `core/usecases/list-benefit-plans.usecase.ts` | `ListBenefitPlansUseCase` |
| `POST /benefit-plans` | aplicación | `core/usecases/create-benefit-plan.usecase.ts` | `CreateBenefitPlanUseCase` — verifica unicidad de nombre |
| `PATCH /benefit-plans/:id` | aplicación | `core/usecases/update-benefit-plan.usecase.ts` | `UpdateBenefitPlanUseCase` |
| `GET /employees/:id/benefits` | aplicación | `core/usecases/get-employee-benefits.usecase.ts` | `GetEmployeeBenefitsUseCase` — verifica ownership o rol HR |
| `POST /employees/:id/benefits` | aplicación | `core/usecases/enroll-benefit.usecase.ts` | `EnrollBenefitUseCase` — valida plan activo, no duplicado |
| `DELETE /employees/:id/benefits/:planId` | aplicación | `core/usecases/unenroll-benefit.usecase.ts` | `UnenrollBenefitUseCase` — sets unenrolled_at = today |
| Adaptador PostgreSQL | infraestructura | `boundary-postgres/repositories/benefit.repository.ts` | `BenefitRepository implements IBenefitRepository` |
| Migración | infraestructura | `boundary-postgres/migrations/006_benefits.sql` | tablas + constraint + FK |
| HTTP handlers | presentación | `api/controllers/benefits.controller.ts` | 6 rutas, sin lógica de negocio |
| Vista HR | UI | `hrms-ui/benefits/benefits-admin-page.component.ts` | Smart component: gestión de planes + inscripciones |
| Vista empleado | UI | `hrms-ui/benefits/my-benefits-page.component.ts` | Smart component: solo lectura — mis beneficios activos |
| HTTP client | UI | `hrms-ui/benefits/benefits.service.ts` | Calls a todos los endpoints |

---

## Contratos entre capas

### Puerto: `IBenefitRepository`

Capacidades atómicas (seguyen el patrón de ADR-0001):

```typescript
// Capacidades atómicas
interface IFindBenefitPlans      { findAll(): Promise<BenefitPlanData[]> }
interface IFindBenefitPlanById   { findById(id: string): Promise<BenefitPlanData | null> }
interface IFindBenefitPlanByName { findByName(name: string): Promise<BenefitPlanData | null> }
interface ICreateBenefitPlan     { create(data: CreateBenefitPlanInput): Promise<BenefitPlanData> }
interface IUpdateBenefitPlan     { update(id: string, data: Partial<CreateBenefitPlanInput>): Promise<BenefitPlanData> }
interface IFindEmployeeBenefits  { findByEmployee(employeeId: string): Promise<EmployeeBenefitData[]> }
interface IFindEnrollment        { findEnrollment(employeeId: string, planId: string): Promise<EmployeeBenefitData | null> }
interface IEnrollBenefit         { enroll(employeeId: string, planId: string, enrolledAt: string): Promise<EmployeeBenefitData> }
interface IUnenrollBenefit       { unenroll(employeeId: string, planId: string, unenrolledAt: string): Promise<EmployeeBenefitData> }

// Contratos compuestos por use case
type ListBenefitPlansRepository    = IFindBenefitPlans
type CreateBenefitPlanRepository   = IFindBenefitPlanByName & ICreateBenefitPlan
type UpdateBenefitPlanRepository   = IFindBenefitPlanById & IUpdateBenefitPlan
type GetEmployeeBenefitsRepository = IFindEmployeeBenefits
type EnrollBenefitRepository       = IFindBenefitPlanById & IFindEnrollment & IEnrollBenefit
type UnenrollBenefitRepository     = IFindEnrollment & IUnenrollBenefit

// Puerto completo (implementado por BenefitRepository)
interface IBenefitRepository extends
  IFindBenefitPlans, IFindBenefitPlanById, IFindBenefitPlanByName,
  ICreateBenefitPlan, IUpdateBenefitPlan,
  IFindEmployeeBenefits, IFindEnrollment,
  IEnrollBenefit, IUnenrollBenefit {}
```

### Dominio: `BenefitPlan`

```typescript
type BenefitPlanType = 'health' | 'life_insurance' | 'dental' | 'vision' | 'pension' | 'other'

class BenefitPlan {
  constructor(private data: BenefitPlanData) {}
  // Valida que el plan esté activo antes de inscribir un empleado
  assertIsActive(): void  // lanza ValidationError si is_active === false
}
```

### DTO: `BenefitPlanData` / `EmployeeBenefitData`

```typescript
interface BenefitPlanData {
  id: string; name: string; type: BenefitPlanType
  description: string | null; provider: string | null
  cost: number | null; isActive: boolean
  createdAt: Date; updatedAt: Date
}

interface EmployeeBenefitData {
  id: string; employeeId: string; planId: string
  enrolledAt: string  // DATE como string YYYY-MM-DD
  unenrolledAt: string | null
  plan?: BenefitPlanData  // join opcional
}
```

**Flujo**: HTTP body → controller (validación Zod) → use case (lógica) → repositorio (persistencia) → DTO de vuelta

---

## Decisiones arquitectónicas

| # | Decisión | Motivo | Alternativa descartada |
|---|---|---|---|
| 1 | Dos componentes Angular separados (`benefits-admin-page` y `my-benefits-page`) | El spec define explícitamente dos vistas con comportamiento opuesto (edición vs solo lectura). Separar evita lógica condicional por rol en un solo componente. Patrón seguido por absences (`my-absences-page` + `approvals-page`). | Un componente único con `@if (isAdmin)` — aumenta la complejidad del template y los tests |
| 2 | `assertIsActive()` en entidad `BenefitPlan` | La invariante "no se puede inscribir en plan inactivo" es lógica de negocio — vive en el dominio. Si viviera en el use case, podría olvidarse en futuros use cases que usen el mismo plan. | Validar `is_active` directamente en `EnrollBenefitUseCase` — acoplamiento de regla a use case |
| 3 | Migración numerada `006_benefits.sql` | Las migraciones existentes van de 001 a 005 secuencialmente. El spec decía `007` (gap sin justificación), se corrige a `006` para mantener secuencia. | `007_benefits.sql` — deja hueco 006 sin uso aparente |
| 4 | `GetEmployeeBenefitsUseCase` recibe `requestingUserId` y `requestingUserRole` | La invariante de ownership (empleado solo ve los suyos, HR ve todos) debe enforcearse en el use case, no solo en el middleware. Patrón establecido en `CancelAbsenceUseCase` que también verifica ownership. | Verificar solo en el controller/middleware — un bug en el guard dejaría el use case sin protección |

---

## Violaciones detectadas y corregidas

_Ninguna. El diseño sigue el patrón hexagonal establecido sin desviaciones._

---

## Lo que NO debe cruzar capas

- `BenefitPlan` (entidad de dominio) no sale de la capa de dominio — el controller recibe `BenefitPlanData` (DTO)
- La validación de `BenefitPlanType` ocurre en el dominio/use case, no solo en el controller Zod schema
- El check de ownership (`employeeId === requestingUserId || isHR`) vive en el use case, no en el controller
- `BenefitRepository` no ejecuta lógica de negocio — solo persiste y recupera

---

## Próximo paso

Continuar con `/tdd-plan` para definir el plan de tests Red/Green/Refactor.
