# HRMS-HEX — Pipeline Changelog

Registro de avance del pipeline SDD. Cada sub-spec pasa por las fases: Spec → Impact → Arch → TDD Plan → Implement → Consolidado.

**Leyenda**: ✅ Completo | 🔄 En progreso | ⏳ Pendiente | ⚠️ Pausado (requiere decisión) | ❌ Bloqueado

---

## Estado global

| Sub-spec | Spec | Impact | Arch | TDD Plan | Implement | Consolidado |
|---|---|---|---|---|---|---|
| 1. hrms-auth-roles    | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. hrms-employees     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. hrms-documents     | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 4. hrms-absences      | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 5. hrms-attendance    | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 6. hrms-payroll       | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 7. hrms-benefits      | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 8. hrms-recruitment   | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 9. hrms-notifications | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 10. hrms-admin        | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

---

## Historial detallado

### 2026-06-13

#### ✅ Sub-spec 2 — hrms-employees — Completo

**Commit**: `de467dd feat(hrms-employees): implement employee management — CRUD, departments, onboarding, Angular UI`

- **Core**: `Employee` domain entity (invariantes `assertCanBeModified` / `assertCanBeTerminated`)
- **Core**: `ManageEmployeesUseCase` (create + update + terminate + onboarding) y `ManageDepartmentsUseCase`
- **Core**: `ValidationError` — nuevo tipo de error de dominio (422 vs 409)
- **DB**: Migración `002_employees.sql` — `departments`, `employees`, `employee_onboarding` + 5 depts seed
- **API**: 9 endpoints nuevos (`/employees` × 7, `/departments` × 2) con validación Zod
- **UI**: `EmployeesListPageComponent` — tabla paginada, filtros, búsqueda debounced
- **UI**: `EmployeeDetailPageComponent` — tabs Info + Onboarding, modal de baja
- **UI**: `EmployeeFormPageComponent` — formulario reactivo create/edit
- **i18n**: Claves `employees.*` en es/en/pt
- **Docs**: Consolidados `hrms-auth-roles.md` y `hrms-employees.md`; 7 archivos intermedios eliminados
- **Tests**: +17 nuevos (8 dominio + 9 usecases) → total **47 tests, 47 passing**

**Fix en la misma sesión** — `d56b2a2 fix(core): extract IPasswordService to restore DIP in Core usecases`

- DIP roto: `Bun.password.hash/verify` llamado desde Core → extraído como `IPasswordService`
- `BunPasswordService` implementado en `packages/api/src/services/`
- Magic number `7` → constante `REFRESH_TOKEN_TTL_DAYS`
- Tests de `LoginUseCase` eliminaron dependencia en `Bun` — ahora mockean `IPasswordService`

---

### 2026-06-12

#### ✅ Fase de Planning — Completada

- **Stack decidido**: PostgreSQL + Bun/TypeScript + Angular
- **Arquitectura**: Hexagonal — Core(contratos) + Boundaries(tecnología) + API(ensamblaje)
- **Idioma código**: Inglés | **Idioma UI**: i18n es/en/pt via @ngx-translate
- **Diseño UI**: Stitch proyecto `13650739638263912450` inspeccionado — 27 pantallas confirmadas
- **MCP Stitch**: Conectado vía HTTP API key
- **Roles confirmados desde Stitch**: Super Admin, HR Manager, Finance, Employee
- **Módulos confirmados desde Stitch**: 10 módulos (evaluaciones fuera de scope v1)

#### ✅ Spec master generado
- Archivo: `docs/specs/hrms-hex.spec.md`
- 10 módulos, 35+ endpoints, modelos completos, i18n añadida

#### ✅ Split confirmado por el usuario
- Archivo: `docs/specs/hrms-hex.split.md`
- 10 sub-specs generados, eje de corte por dominio de negocio
- Orden: 1 → 2 → {3,4,5,7,8} → 6 → 9 → 10

#### ✅ Sub-specs generados (Spec completo)
- `docs/specs/hrms-auth-roles.spec.md`
- `docs/specs/hrms-employees.spec.md`
- `docs/specs/hrms-documents.spec.md`
- `docs/specs/hrms-absences.spec.md`
- `docs/specs/hrms-attendance.spec.md`
- `docs/specs/hrms-payroll.spec.md`
- `docs/specs/hrms-benefits.spec.md`
- `docs/specs/hrms-recruitment.spec.md`
- `docs/specs/hrms-notifications.spec.md`
- `docs/specs/hrms-admin.spec.md`

---

## Próximas tareas confirmadas por el usuario

> Marcar como ✅ cuando el usuario confirme cada entrega.

### Sub-spec 1: hrms-auth-roles ✅

- [x] `/impact` → `hrms-auth-roles.impact.md` ✅
- [x] `/arch` → `hrms-auth-roles.arch.md` ✅
- [x] `/tdd-plan` → `hrms-auth-roles.tdd-plan.md` ✅ 40 tests (8 domain, 14 usecases, 9 infra, 9 API)
- [x] `/tdd-plan-ui` → `hrms-auth-roles.tdd-plan-ui.md` ✅ 38 tests
- [x] `/implement` — 30 tests GREEN, Angular UI completo ✅
- [x] Consolidación → `docs/specs/hrms-auth-roles.md` ✅
- [ ] Merge a `main`

### Sub-spec 2: hrms-employees ✅

- [x] Implementación completa (pipeline condensado con implement) ✅
- [x] Consolidación → `docs/specs/hrms-employees.md` ✅
- [x] 47 tests passing ✅
- [ ] Merge a `main`

### Sub-specs 3-5, 7-8 (paralelos después de employees)
_(cada uno en su propia rama)_

- [ ] hrms-documents completo + merge
- [ ] hrms-absences completo + merge
- [ ] hrms-attendance completo + merge
- [ ] hrms-benefits completo + merge
- [ ] hrms-recruitment completo + merge

### Sub-spec 6: hrms-payroll
_(después de absences + attendance)_
- [ ] Completo + merge

### Sub-spec 9: hrms-notifications
_(después de todos los anteriores)_
- [ ] Completo + merge

### Sub-spec 10: hrms-admin
_(último)_
- [ ] Completo + merge

---

## Decisiones tomadas durante el pipeline

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-06-12 | Stack: PostgreSQL + Bun/TS + Angular | Sinergia TS full-stack, mejor productividad para CRUD+workflows |
| 2026-06-12 | Idioma código: inglés | Estándar industria, compatible con librerías |
| 2026-06-12 | i18n: es/en/pt via @ngx-translate | Runtime switching sin recompilación |
| 2026-06-12 | Evaluaciones fuera de scope v1 | Sin pantallas en Stitch aún |
| 2026-06-12 | Notificaciones solo vía Slack | Stitch muestra exclusivamente integración Slack |
| 2026-06-12 | 10 sub-specs por dominio de negocio | Spec master demasiado grande para pipeline único |

---

## Deuda técnica identificada

### Funcional

| # | Descripción | Sub-spec | Impacto | Cuándo |
|---|---|---|---|---|
| 1 | Login sin recuperación de contraseña | hrms-auth-roles | medio | v2 |
| 2 | Interceptor HTTP Angular para renovar access_token automáticamente no implementado | hrms-auth-roles | alto | antes de go-live |
| 3 | Employee creation no atómica: si `userRepo.create` falla post-commit, queda empleado sin cuenta | hrms-employees | medio | cuando se implemente saga/compensating transaction |
| 4 | Endpoint `GET /employees/export` (CSV) referenciado en UI pero no implementado | hrms-employees | bajo | hrms-admin |
| 5 | Tests de integración de repositorios contra DB real pendientes | ambos | medio | antes de go-live |
| 6 | Nómina sin cálculo fiscal/impuestos | hrms-payroll | medio | cuando se requiera compliance |
| 7 | Reclutamiento solo interno (sin portal público) | hrms-recruitment | bajo | v2 |

### Seguridad (ver detalle completo en `docs/security-debt.md`)

Análisis `/sdd-security` 2026-06-13 — 0🔴 6🟠 9🟡 1🟢 hallazgos.

| # | ID | Descripción | Prioridad | Cuándo |
|---|---|---|---|---|
| S1 | SEC-9 | Puerto PostgreSQL 5432 expuesto al host en docker-compose.yml | 🔴 | antes del primer deploy |
| S2 | SEC-8 | Sin rate limiting en `/auth/login` — brute-force irrestricto | 🔴 | antes del primer deploy |
| S3 | SEC-11 | Sin headers HTTP de seguridad (CSP, X-Frame-Options, HSTS) | 🔴 | antes del primer deploy |
| S4 | SEC-13 | Sin error handler global — potencial exposición de stack traces | 🔴 | antes del primer deploy |
| S5 | SEC-12 | JWT_SECRET sin validación de longitud mínima al startup | 🔴 | antes del primer deploy |
| S6 | SEC-4 | `status: q.status as any` — parámetro no validado pasa al repositorio | 🔴 | antes del primer deploy |
| S7 | SEC-10 | Sin cap en parámetro `limit` — potencial DoS por consultas masivas | 🔴 | antes del primer deploy |
| S8 | SEC-2 | Timing attack en login — enumeración de usuarios por tiempo de respuesta | 🟠 | antes de go-live |
| S9 | SEC-15 | Refresh token en localStorage — vulnerable a XSS (requiere httpOnly cookie) | 🟠 | antes de go-live |
| S10 | SEC-3 | IDOR potencial en `GET /employees/:id` — sin filtro de ownership por rol | 🟠* | antes de go-live |
| S11 | SEC-7 | 47 vulnerabilidades en npm Angular UI (29 high) — requiere audit + fix | 🟠 | antes de go-live |
| S12 | SEC-5 | Sin HTTPS en docker-compose.yml — tráfico en texto plano | 🟠 | antes de go-live |
| S13 | SEC-14 | Sin audit trail para login, cambios de rol y terminaciones | 🟡 | siguiente sprint |
| S14 | SEC-16 | `super_admin` verificado por nombre de rol en cliente, no por permisos | 🟡 | siguiente sprint |
| S15 | SEC-1 | Credenciales débiles de dev commiteadas — sin `.env` gitignored | 🟡 | siguiente sprint |

*S10: verificar manualmente que el seed no da `canView: true` en EMPLOYEES al rol "Employee" — si lo hace, escala a 🔴.
