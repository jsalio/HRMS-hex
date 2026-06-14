# Deuda técnica de seguridad — HRMS-HEX

Hallazgos del análisis `/sdd-security` del 2026-06-13 sobre sub-specs 1 (hrms-auth-roles) y 2 (hrms-employees).

Fuente completa: `docs/specs/hrms-employees.security.md`

**Leyenda prioridad**: 🔴 Antes del primer deploy · 🟠 Antes de go-live · 🟡 Siguiente sprint · 🟢 Algún día

---

## Backlog de seguridad

| # | ID | Severidad original | Descripción | Archivo(s) | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | SEC-9 | 🟠 | Quitar exposición de puerto PostgreSQL 5432 al host — sin código, solo config | `docker-compose.yml:12` | 🔴 | XS |
| 2 | SEC-11 | 🟡 | Agregar `secureHeaders()` middleware de Hono (CSP, X-Frame-Options, HSTS…) | `packages/api/src/index.ts` | 🔴 | XS |
| 3 | SEC-13 | 🟡 | Agregar `app.onError` global para evitar exposición de stack traces | `packages/api/src/index.ts` | 🔴 | XS |
| 4 | SEC-12 | 🟡 | Validar longitud mínima de `JWT_SECRET` al startup (≥ 64 chars) | `packages/api/src/container.ts:13` | 🔴 | XS |
| 5 | SEC-4 | 🟡 | Validar parámetro `status` con `EMPLOYEE_STATUS.optional()` en lugar de `as any` | `packages/api/src/controllers/employees.controller.ts:54` | 🔴 | XS |
| 6 | SEC-10 | 🟡 | Agregar cap `Math.min(limit, 100)` en paginación de empleados | `packages/api/src/controllers/employees.controller.ts:57` | 🔴 | XS |
| 7 | SEC-8 | 🟠 | Agregar rate limiting en `POST /auth/login` y `POST /auth/refresh` | `packages/api/src/controllers/auth.controller.ts:29` | 🔴 | S |
| 8 | SEC-2 | 🟠 | Mitigar timing attack en login — siempre llamar `verify()` con hash dummy si usuario no existe | `packages/core/src/usecases/login.usecase.ts:29` | 🟠 | S |
| 9 | SEC-16 | 🟡 | Reemplazar `user.role.name === 'super_admin'` por verificación basada en permisos | `apps/hrms-ui/src/app/core/services/auth.service.ts:61` | 🟡 | S |
| 10 | SEC-7 | 🟠 | Auditar dependencias npm Angular UI — `npm audit --production` + fix sin breaking changes | `apps/hrms-ui/package.json` | 🟠 | M |
| 11 | SEC-14 | 🟡 | Implementar audit trail (tabla `audit_log`) para login, cambios de rol y terminación de empleados | DB + use cases | 🟡 | M |
| 12 | SEC-3 | 🟠 | Definir política de acceso por rol en `GET /employees/:id` — verificar que rol "Employee" tiene `canView: false`, o implementar endpoint `/me` | `packages/api/src/controllers/employees.controller.ts:80` | 🟠* | M |
| 13 | SEC-5 | 🟡 | Agregar terminación TLS vía reverse proxy (nginx/Caddy) para producción | `docker-compose.yml` | 🟠 | M |
| 14 | SEC-1 | 🟡 | Crear `.env.example` con placeholders y gitignore `.env` — reemplazar credenciales en docker-compose.yml | `docker-compose.yml:10,32` | 🟡 | S |
| 15 | SEC-15 | 🟠 | Mover refresh token de `localStorage` a cookie `httpOnly; Secure; SameSite=Strict` | `apps/hrms-ui/src/app/core/services/auth.service.ts:23-24` + API | 🟠 | L |

*SEC-3: si el rol "Employee" tiene `canView: true` en EMPLOYEES, escala a 🔴 y bloquea el deploy.

---

## Sub-spec 3 — hrms-documents (2026-06-13)

| # | ID | Severidad | Descripción | Archivo(s) | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 16 | SEC-D1 | 🟡 | `file_url` se renderiza como `[href]` — Angular sanitiza automáticamente, pero si se agrega `bypassSecurityTrustUrl` en el futuro se abre XSS | `apps/hrms-ui/src/app/documents/documents-page.component.ts` | 🟡 | XS |
| 17 | SEC-D2 | 🟡 | `DocumentRepository.findExpiring` no valida que `daysFromNow >= 0`; el cap está en el controlador pero no en el repositorio (violación de defense-in-depth) | `packages/boundary-postgres/src/repositories/document.repository.ts:findExpiring` | 🟡 | XS |
| 18 | SEC-D3 | 🟠 | `fileHash` aceptado del cliente sin verificar que sea hex válido (solo valida longitud 64). Un actor malicioso puede registrar cualquier string de 64 chars como firma válida, comprometiendo la inmutabilidad del documento | `packages/api/src/controllers/documents.controller.ts:signDocumentSchema` | 🟠 | S |

---

## Sub-spec 4 — hrms-absences (2026-06-13)

| # | ID | Severidad | Descripción | Archivo(s) | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 19 | SEC-A1 | 🟡 | `isManager()` verifica `role.name === 'hr_manager'` — string hardcodeado; si el nombre del rol cambia en DB los managers pierden acceso sin error visible | `packages/api/src/controllers/absences.controller.ts:isManager` | 🟡 | S |
| 20 | SEC-A2 | 🟡 | `PATCH /absence-requests/:id/cancel` usa `requirePermission(ABSENCES, 'canView')` pero la operación modifica estado — debería requerir `canCreate` o un permiso de cancelación explícito | `packages/api/src/controllers/absences.controller.ts:cancel` | 🟡 | XS |
| 21 | SEC-A3 | 🟡 | `approvals-page.component.ts` muestra `employeeId` (UUID) en lugar del nombre del empleado — filterable por UUID revela IDs internos en la UI | `apps/hrms-ui/src/app/absences/approvals-page.component.ts` | 🟡 | M |

---

## Sub-spec 5 — hrms-attendance (2026-06-14)

| # | ID | Severidad | Descripción | Archivo(s) | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 22 | SEC-AT1 | 🟡 | `PATCH /attendance/:id` no verifica ownership — cualquier usuario con `canEdit` puede editar el registro de cualquier empleado sin restricción de scope | `packages/api/src/controllers/attendance.controller.ts:patch` | 🟡 | S |
| 23 | SEC-AT2 | 🟡 | `GET /attendance` sin `employee_id` devuelve todos los registros — un empleado con `canView` puede ver la asistencia de toda la empresa | `packages/api/src/controllers/attendance.controller.ts:GET /` | 🟡 | S |
| 24 | SEC-AT3 | 🟡 | `POST /check-in` y `POST /check-out` no verifican que el `employee_id` del body corresponda al usuario autenticado — un usuario puede fichar en nombre de otro | `packages/api/src/controllers/attendance.controller.ts:check-in,check-out` | 🟡 | S |

---

## Grupos de trabajo

### Grupo A — Quick wins (XS, antes del primer deploy)
Items 1–6. Son todos cambios de 1–5 líneas. Se pueden hacer en una sola sesión.

```
1. docker-compose.yml → quitar ports del servicio db
2. index.ts           → app.use('*', secureHeaders())
3. index.ts           → app.onError(...)
4. container.ts       → validar jwtSecret.length >= 64
5. employees.ctrl.ts  → EMPLOYEE_STATUS.optional().safeParse(q.status)
6. employees.ctrl.ts  → Math.min(Number(q.limit), 100)
```

### Grupo B — Auth hardening (S/M, antes de go-live)
Items 7, 8, 12. Afectan el flujo de autenticación y autorización.

### Grupo C — Infraestructura de producción (M, antes de go-live)
Items 10, 13. Requieren configuración de infraestructura, no código de aplicación.

### Grupo D — Refactors estructurales (L, antes de go-live)
Item 15. Mover tokens a cookies httpOnly requiere cambio de contrato entre API y UI.

### Grupo E — Trazabilidad (M, próximo sprint)
Items 9, 11, 14. Mejoras de observabilidad y hardening secundario.

---

## Verificaciones manuales pendientes

- [ ] Confirmar que el seed no asigna `canView: true` en EMPLOYEES al rol "Employee" → afecta prioridad de item 12
- [ ] Ejecutar `npm audit --production` en `apps/hrms-ui` y reportar cuántas vulnerabilidades son de producción vs build tools → afecta prioridad de item 10
