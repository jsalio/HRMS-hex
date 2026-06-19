# Impact Analysis: hrms-benefits

**Feature**: Planes de beneficios y asignación por empleado
**Spec de origen**: docs/specs/hrms-benefits.spec.md
**Fecha**: 2026-06-18
**Epicentro del cambio**: Nuevas entidades `benefit_plans` y `employee_benefits` + contratos y use cases en core
**Tipo de cambio**: Aditivo — no modifica entidades ni contratos existentes

---

## Resumen ejecutivo

Impacto contenido y bien delimitado. El feature es completamente aditivo: no modifica ninguna entidad de dominio existente ni ningún contrato previo. Los únicos archivos existentes que se modifican son los índices de exportación (`contracts/index.ts`, `core/index.ts`, `boundary-postgres/index.ts`), el contenedor de dependencias, el router de la API y el router de Angular. Un hallazgo a verificar: el número de migración `007_benefits.sql` del spec salta el `006` — debe decidirse si usar `006` (secuencial) o reservar el rango para payroll.

---

## Mapa de zonas afectadas

| Archivo / Módulo | Capa | Tipo de cambio | Severidad |
|---|---|---|---|
| `packages/core/src/contracts/benefits.ts` | Core/Contratos | NUEVO | 🟢 |
| `packages/core/src/domain/benefit-plan.ts` | Core/Dominio | NUEVO | 🟢 |
| `packages/core/src/usecases/list-benefit-plans.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/usecases/create-benefit-plan.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/usecases/update-benefit-plan.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/usecases/get-employee-benefits.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/usecases/enroll-benefit.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/usecases/unenroll-benefit.usecase.ts` | Core/UseCases | NUEVO | 🟢 |
| `packages/core/src/contracts/index.ts` | Core/Contratos | modificado — nuevos re-exports | 🟢 |
| `packages/core/src/index.ts` | Core | modificado — nuevos re-exports | 🟢 |
| `packages/boundary-postgres/src/migrations/006_benefits.sql` | Infra/DB | NUEVO (ver nota migración) | 🟡 |
| `packages/boundary-postgres/src/repositories/benefit.repository.ts` | Infra/Repo | NUEVO | 🟢 |
| `packages/boundary-postgres/src/index.ts` | Infra | modificado — nuevo re-export | 🟢 |
| `packages/api/src/container.ts` | API/DI | modificado — nuevas instancias | 🟢 |
| `packages/api/src/controllers/benefits.controller.ts` | API | NUEVO | 🟢 |
| `packages/api/src/index.ts` | API | modificado — nuevas rutas | 🟢 |
| `apps/hrms-ui/src/app/benefits/` | UI | NUEVO (directorio completo) | 🟢 |
| `apps/hrms-ui/src/app/app.routes.ts` | UI/Routing | modificado — ruta `/benefits` ausente | 🟡 |
| `apps/hrms-ui/src/assets/i18n/es.json` | UI/i18n | modificado — namespace `benefits.*` | 🟢 |
| `apps/hrms-ui/src/assets/i18n/en.json` | UI/i18n | modificado — namespace `benefits.*` | 🟢 |
| `apps/hrms-ui/src/assets/i18n/pt.json` | UI/i18n | modificado — namespace `benefits.*` | 🟢 |

---

## Side-effects por severidad

### 🔴 Críticos
_Ninguno — el cambio es completamente aditivo._

### 🟠 Altos
_Ninguno._

### 🟡 Medios

- **Número de migración en el spec**: El spec dice `007_benefits.sql` pero el último archivo existente es `005_attendance.sql`. El número `006` queda libre. Opciones:
  - Usar `006_benefits.sql` (secuencial, recomendado) — payroll usará `007` cuando se implemente
  - Respetar `007_benefits.sql` del spec — deja un hueco `006` sin uso aparente
  - Decisión tomada: **usar `006_benefits.sql`** (secuencial). El spec tenía un gap planificado para un módulo que podría no existir.

- **Ruta `/benefits` ausente en `app.routes.ts`**: El `shell.component.ts` ya tiene el nav item para benefits (`path: '/benefits'`) pero `app.routes.ts` no declara esa ruta. Si el usuario navega a `/benefits` ahora mismo, cae en el `**` redirect. Esto es un side-effect conocido que debe resolverse en esta implementación.

### 🟢 Bajos

- **`AppModule.BENEFITS = 'benefits'`** ya está declarado en `contracts/roles.ts` y el sidebar ya lo incluye — no requieren cambio.
- **`documents` route**: la ruta `/documents` tampoco está en `app.routes.ts` — fuera del scope de este sub-spec pero vale documentarlo como deuda preexistente.

---

## Base de datos

- **Migración necesaria**: sí — `006_benefits.sql`
- **Datos existentes en riesgo**: no — tablas nuevas, sin ALTER a tablas existentes
- **Detalle**: Se crean `benefit_plans` y `employee_benefits`. La FK `employee_benefits.employee_id → employees(id)` requiere que `employees` exista (garantizado por la migración 002 que corre antes). La FK `employee_benefits.plan_id → benefit_plans(id)` es interna al sub-spec.

---

## Contratos que cambian

Ningún contrato existente cambia. Los nuevos contratos son aditivos:
- `IBenefitRepository` — nuevo puerto en `contracts/benefits.ts`
- Nuevos tipos: `BenefitPlanType`, `BenefitPlanData`, `EmployeeBenefitData`
- Nuevos re-exports en `contracts/index.ts` y `core/index.ts`

---

## Puntos ciegos (verificación manual requerida)

- [ ] Confirmar que el seed de datos de `benefit_plans` (si aplica) se incluye en la migración o se documenta como paso manual de configuración inicial
- [ ] Verificar que `permissionGuard(AppModule.BENEFITS, 'canView')` funciona correctamente para la vista de empleado (que tiene permisos limitados de benefits por defecto en el seed)
- [ ] Confirmar comportamiento de la UI cuando un empleado no tiene ningún beneficio activo (estado vacío)

---

## Checklist antes de implementar

- [x] Todos los archivos de la tabla "mapa de zonas" están identificados
- [x] La migración está planificada (`006_benefits.sql`)
- [x] No hay tests existentes que fallen — el cambio es completamente aditivo
- [x] `AppModule.BENEFITS` y nav item ya existen — sin cambio de contratos
- [ ] Decidir si se incluye seed de planes de beneficios predeterminados en la migración

---

## Próximo paso

Continuar con `/arch` para mapear la arquitectura hexagonal del feature.
