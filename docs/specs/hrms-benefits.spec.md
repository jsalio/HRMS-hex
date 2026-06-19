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

**GET /benefit-plans**
```
Response 200: BenefitPlan[]
Requiere: can_view en 'benefits'
```

**POST /benefit-plans**
```
Body: { name, type, description?, provider?, cost? }
Response 201: BenefitPlan
Requiere: can_create en 'benefits' (hr_manager/super_admin)
Errores: 409 nombre duplicado | 422 type inválido
```

**PATCH /benefit-plans/:id**
```
Body: Partial<{ name, type, description, provider, cost, is_active }>
Response 200: BenefitPlan
Requiere: can_edit en 'benefits' (hr_manager/super_admin)
Errores: 404 plan no encontrado | 422 type inválido
```

**GET /employees/:id/benefits**
```
Response 200: EmployeeBenefit[] (con plan info)
Requiere: can_view en 'benefits'
Restricción: el usuario autenticado debe ser el propietario (employeeId === :id)
            O tener rol hr_manager / super_admin
```

**POST /employees/:id/benefits**
```
Body: { plan_id, enrolled_at }
Response 201: EmployeeBenefit
Requiere: can_create en 'benefits' (hr_manager/super_admin)
Errores: 409 ya inscrito y activo | 422 plan inactivo
```

**DELETE /employees/:id/benefits/:planId**
```
Response 200: EmployeeBenefit (unenrolled_at = today)
Requiere: can_edit en 'benefits' (hr_manager/super_admin)
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
| 4 | Un empleado autenticado solo puede ver sus propios beneficios; hr_manager/super_admin ven todos |
| 5 | Solo usuarios con can_edit en 'benefits' pueden dar de baja a un empleado de un plan |
| 6 | El campo `type` de benefit_plans se valida en dominio antes de llegar a DB (enum: health, life_insurance, dental, vision, pension, other) |

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
