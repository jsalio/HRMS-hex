# SDD Spec: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**User story**: Como HR Admin quiero crear planes de beneficios y asignarlos a empleados; como empleado quiero ver mis beneficios activos
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 7 de 10
**Dependencias**: hrms-employees completo

---

## Modelo de datos

```sql
CREATE TABLE benefit_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  type        VARCHAR(50) NOT NULL
              CHECK (type IN ('health','life_insurance','dental','vision','pension','other')),
  description TEXT,
  provider    VARCHAR(100),
  cost        NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_benefits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  plan_id       UUID NOT NULL REFERENCES benefit_plans(id),
  enrolled_at   DATE NOT NULL,
  unenrolled_at DATE,
  UNIQUE(employee_id, plan_id),
  CONSTRAINT valid_enrollment CHECK (unenrolled_at IS NULL OR unenrolled_at > enrolled_at)
);
```

---

## Contratos de API

**GET /benefit-plans** — `Response 200: BenefitPlan[]`

**POST /benefit-plans** — Body: `{name, type, description?, provider?, cost?}` → `201 BenefitPlan`

**PATCH /benefit-plans/:id** — Body: partial → `200 BenefitPlan`

**GET /employees/:id/benefits** — `Response 200: EmployeeBenefit[]` (con plan info)

**POST /employees/:id/benefits**
```
Body: { plan_id, enrolled_at }
Response 201: EmployeeBenefit
Errores: 409 ya inscrito y activo | 422 plan inactivo
```

**DELETE /employees/:id/benefits/:planId**
```
Response 200: EmployeeBenefit (unenrolled_at = today)
Errores: 404 no inscrito
```

---

## Máquina de estados del frontend

```
BENEFITS_ADMIN: lista de planes + tabla empleados/plan
  → [+ plan]         → PLAN_FORM
  → [inscribir]      → ENROLL_MODAL (selecciona empleado + fecha)
  → [dar de baja]    → UNENROLL_CONFIRM

BENEFITS_EMPLOYEE: mis beneficios activos (solo lectura)
  → lista con nombre, tipo, proveedor, fecha inscripción
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | No se puede inscribir a un empleado en un plan inactivo |
| 2 | No se puede inscribir dos veces al mismo empleado en el mismo plan activo |
| 3 | Empleado INACTIVE puede ver sus beneficios históricos (solo lectura) |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/benefits.ts` | NUEVO |
| `packages/core/src/domain/benefit-plan.ts` | NUEVO |
| `packages/boundary-postgres/migrations/007_benefits.sql` | NUEVO |
| `packages/api/src/controllers/benefits.controller.ts` | NUEVO |
| `apps/hrms-ui/src/app/benefits/` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/*.json` | MODIFICADO — claves benefits.* |

---

## Fuera de scope

- Portal de selección de beneficios por empleado (open enrollment)
- Integración con aseguradoras
- Costos compartidos empleado/empleador
