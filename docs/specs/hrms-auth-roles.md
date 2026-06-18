# hrms-auth-roles — Autenticación, Roles y Permisos

**Fecha**: 2026-06-12
**Estado**: Implementado
**Actualizado**: 2026-06-18 — post INC-002 (refactor a use cases atómicos, ver `docs/sdd-incident-log.md`)
**Commit**: feat(hrms-auth-roles): implement JWT auth, roles/permissions and app shell (#1/10)
**Sub-spec**: 1 de 10 del sistema HRMS-HEX

---

## Qué es este feature

Este sub-spec establece los cimientos de seguridad del sistema HRMS. Antes de él, el sistema no existía. Después de él, los usuarios pueden iniciar sesión, mantener su sesión activa de forma segura, y acceder solo a los módulos para los que tienen permiso.

El HR Manager puede crear roles con combinaciones de permisos granulares por módulo (ver, crear, editar, eliminar, exportar). Cada usuario tiene exactamente un rol. El rol `super_admin` tiene acceso total como invariante de dominio, no como configuración — no puede perderse accidentalmente.

Los 9 sub-specs restantes heredan el patrón de guards (`authGuard`, `permissionGuard`), el enum `AppModule`, y el contrato `AuthenticatedUser` establecidos aquí.

---

## Qué se construyó

### Modelo de datos

```sql
CREATE TABLE roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(50) NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module      VARCHAR(50) NOT NULL
    CHECK (module IN ('dashboard','employees','attendance','payroll','reports',
                      'settings','documents','absences','benefits','recruitment','notifications')),
  can_view    BOOLEAN NOT NULL DEFAULT false,
  can_create  BOOLEAN NOT NULL DEFAULT false,
  can_edit    BOOLEAN NOT NULL DEFAULT false,
  can_delete  BOOLEAN NOT NULL DEFAULT false,
  can_export  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       UUID NOT NULL REFERENCES roles(id),
  employee_id   UUID NULL,           -- FK a employees agregada en migración 002
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seed: 4 roles (super_admin, hr_manager, finance, employee) + admin@hrms.com.

### Contratos de API

| Método | Ruta | Descripción |
|---|---|---|
| POST | /auth/login | Autentica, devuelve `{ access_token, user: AuthenticatedUser }` |
| POST | /auth/refresh | Rota refresh token, devuelve nuevo access_token |
| POST | /auth/logout | Revoca el refresh token actual |
| GET | /roles | Lista roles con permisos |
| POST | /roles | Crear rol personalizado |
| PATCH | /roles/:id | Actualizar permisos de un rol |
| DELETE | /roles/:id | Eliminar rol no-sistema |

**AuthenticatedUser** (contrato congelado):
```typescript
interface AuthenticatedUser {
  id: string
  email: string
  employeeId?: string
  role: {
    id: string
    name: string
    permissions: RolePermission[]
  }
}
```

### Invariantes del sistema

1. El rol `super_admin` devuelve todos los permisos en `true` — implementado en `Role.toAuthPermissions()`, no en DB.
2. Los roles de sistema (`is_system = true`) no pueden eliminarse.
3. `AppModule` enum tiene exactamente 11 valores que coinciden con el CHECK constraint de `role_permissions.module`.
4. El access token dura 15 minutos. El refresh token dura 7 días con rotación en cada uso.

---

## Cómo está estructurado el código

### Patrón arquitectónico

Hexagonal (Ports & Adapters) con Bun workspaces:
```
packages/core        ← sin dependencias externas
packages/boundary-postgres  ← implementa IUserRepository, IRoleRepository, IRefreshTokenRepository
packages/api         ← Hono + container.ts (DI manual)
apps/hrms-ui         ← Angular 18 standalone
```

### Archivos creados

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `packages/core/src/contracts/auth.ts` | Core | AuthenticatedUser, IUserRepository, IRefreshTokenRepository |
| `packages/core/src/contracts/roles.ts` | Core | AppModule enum, RolePermission, IRoleRepository |
| `packages/core/src/domain/role.ts` | Core | Role entity con toAuthPermissions() + invariante super_admin |
| `packages/core/src/domain/errors.ts` | Core | DomainError, NotFoundError, ConflictError, ValidationError |
| `packages/core/src/usecases/login.usecase.ts` | Core | `LoginUseCase` — autentica, construye `AuthenticatedUser`, emite access + refresh token |
| `packages/core/src/usecases/refresh-token.usecase.ts` | Core | `RefreshTokenUseCase` — rota refresh token (revoca anterior, emite nuevo) |
| `packages/core/src/usecases/create-role.usecase.ts` | Core | `CreateRoleUseCase` — crea rol verificando unicidad de nombre |
| `packages/core/src/usecases/update-role.usecase.ts` | Core | `UpdateRoleUseCase` — actualiza nombre y/o permisos; aplica invariante super_admin |
| `packages/core/src/usecases/delete-role.usecase.ts` | Core | `DeleteRoleUseCase` — elimina rol verificando que no sea de sistema |
| `packages/core/src/usecases/list-roles.usecase.ts` | Core | `ListRolesUseCase` — devuelve el catálogo completo de roles |
| `packages/boundary-postgres/src/migrations/001_auth_roles.sql` | Infra | Tablas + seed |
| `packages/boundary-postgres/src/repositories/user.repository.ts` | Infra | UserRepository |
| `packages/boundary-postgres/src/repositories/role.repository.ts` | Infra | RoleRepository |
| `packages/boundary-postgres/src/repositories/refresh-token.repository.ts` | Infra | RefreshTokenRepository |
| `packages/api/src/container.ts` | API/DI | Instancia y exporta todos los use cases |
| `packages/api/src/controllers/auth.controller.ts` | API | /auth/* endpoints |
| `packages/api/src/controllers/roles.controller.ts` | API | /roles endpoints |
| `packages/api/src/middleware/auth.middleware.ts` | API | JWT verification |
| `apps/hrms-ui/src/app/core/services/auth.service.ts` | UI | Estado auth, hasPermission(), login/logout |
| `apps/hrms-ui/src/app/core/guards/auth.guard.ts` | UI | Redirige a /login si no autenticado |
| `apps/hrms-ui/src/app/core/guards/permission.guard.ts` | UI | permissionGuard(AppModule, action) |
| `apps/hrms-ui/src/app/auth/login/login-page.component.ts` | UI | Split-panel login |
| `apps/hrms-ui/src/app/shell/shell.component.ts` | UI | Sidebar + header + language selector |
| `apps/hrms-ui/src/app/roles/roles-page.component.ts` | UI | CRUD de roles |

---

## Cómo se verifica

Correr: `bun test`

### Tests de dominio (`packages/core-tests/src/domain/role.test.ts`)

| Test | Qué verifica |
|---|---|
| `given_role_with_super_admin_name_when_toAuthPermissions_then_all_are_true` | Invariante super_admin — todos los permisos en true |
| `given_non_super_admin_role_when_toAuthPermissions_then_returns_stored_permissions` | Roles normales devuelven solo sus permisos asignados |
| `given_system_role_when_rename_then_throws_DomainError` | Roles de sistema no pueden renombrarse |
| `given_system_role_when_assertCanDelete_then_throws_DomainError` | Roles de sistema no pueden eliminarse |
| `given_super_admin_role_with_stored_false_permissions_when_toAuthPermissions_then_invariant_overrides_to_true` | La invariante super_admin no depende de los permisos almacenados |
| `AppModule_enum_values_match_expected_strings` | Los 11 valores del enum coinciden con los CHECK constraints de DB |

### Tests de use cases (`packages/core-tests/src/usecases/`)

| Test | Use case | Qué verifica |
|---|---|---|
| `given_valid_credentials_when_execute_then_returns_tokens_and_user` | LoginUseCase | happy path — devuelve tokens y AuthenticatedUser |
| `given_valid_login_when_execute_then_AuthenticatedUser_has_exact_contract_shape` | LoginUseCase | contrato congelado — estructura anidada `role.{id,name,permissions}` |
| `given_invalid_password_when_execute_then_throws_UnauthorizedError` | LoginUseCase | contraseña incorrecta |
| `given_unknown_email_when_execute_then_throws_UnauthorizedError` | LoginUseCase | email inexistente |
| `given_inactive_user_when_execute_then_throws_UnauthorizedError` | LoginUseCase | usuario inactivo |
| `given_valid_login_when_execute_then_refresh_token_is_stored` | LoginUseCase | el refresh token se persiste en DB |
| `given_valid_refresh_token_when_execute_then_returns_new_access_token` | RefreshTokenUseCase | happy path — emite nuevo par de tokens |
| `given_valid_refresh_token_when_execute_then_old_token_is_revoked_and_new_one_created` | RefreshTokenUseCase | rotación — revoca anterior, crea nuevo |
| `given_expired_refresh_token_when_execute_then_throws_UnauthorizedError` | RefreshTokenUseCase | token expirado |
| `given_revoked_refresh_token_when_execute_then_throws_UnauthorizedError` | RefreshTokenUseCase | token revocado |
| `given_valid_role_data_when_execute_then_returns_role` | CreateRoleUseCase | happy path |
| `given_duplicate_name_when_execute_then_throws_ConflictError` | CreateRoleUseCase | nombre duplicado |
| `given_super_admin_role_when_execute_with_false_permissions_then_toAuthPermissions_still_all_true` | UpdateRoleUseCase | invariante super_admin sobrevive al update |
| `given_system_role_when_execute_then_throws_DomainError` | DeleteRoleUseCase | no eliminar roles de sistema |
| `given_custom_role_when_execute_then_deletes` | DeleteRoleUseCase | happy path |
| `given_roles_exist_when_execute_then_returns_all_roles` | ListRolesUseCase | delegación correcta |

---

## Decisiones tomadas y por qué

**JWT stateless (access 15min + refresh 7d con rotación)** — Los múltiples pods de API no comparten estado. JWT permite verificación local sin roundtrip a DB. La rotación del refresh token detecta tokens robados porque el primer uso legítimo invalida el token robado. Alternativa descartada: sesiones en PostgreSQL (roundtrip por request, no escala horizontal).

**AppModule enum en Core** — El CHECK constraint de `role_permissions.module` lista 11 módulos como strings. Un guard que escriba `'employee'` (singular) en lugar de `'employees'` produce un 403 silencioso sin error de compilación. El enum convierte ese bug en un error de TypeScript detectado en build. Alternativa descartada: `as const` object (menos ergonómico como tipo de función).

**Invariante super_admin en `Role.toAuthPermissions()`** — Si viviera en DB (trigger), un UPDATE directo podría saltarla. Si viviera en middleware, un endpoint nuevo podría olvidarse de llamarlo. En el dominio, toda la lógica pasa por `toAuthPermissions()` obligatoriamente. Alternativa descartada: trigger PostgreSQL (duplica lógica de negocio en SQL).

**FK `users.employee_id` diferida a migración 002** — En 001, la tabla `employees` no existe. Las opciones eran crear un placeholder en 001 (viola separación de sub-specs) o diferir la FK (limpio y explícito). Alternativa descartada: DEFERRABLE constraint (complejo para tests de integración).

**DI manual con `container.ts`** — Bun no soporta `reflect-metadata` de forma estable (necesario para InversifyJS/TSyringe). La instanciación manual es type-safe, explícita, zero-dependency. Para un sistema de 10 sub-specs con ~30 dependencias, el overhead de un framework DI no se justifica. Alternativa descartada: InversifyJS (incompatible con Bun).

**`postgres.js` como driver** — Prisma requiere un binary engine que no funciona nativamente en Bun. Drizzle duplicaría la capa de abstracción que los repositorios hexagonales ya proveen. `postgres.js` es SQL puro + wrapper delgado. Alternativa descartada: Drizzle ORM (válida pero redundante con repositorios hexagonales).

**Angular 18 standalone sin NgModules** — Angular 18 marca NgModules como legacy. Standalone components son la dirección oficial: lazy loading con `loadComponent`/`loadChildren`, tree-shaking más fino, menos boilerplate. Alternativa descartada: NgModules (funciona pero introduce un nivel innecesario de indirección).

---

## Side-effects manejados

- `@ngx-translate/core` instalado en este sub-spec — heredado por todos los demás.
- `permissionGuard` como factory function (no clase) — compatible con Angular 18 `CanActivateFn`.
- Seed con `ON CONFLICT DO NOTHING` — idempotente en re-ejecuciones de migración.

---

## Deuda técnica

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | Interceptor HTTP de Angular para renovar automáticamente el access_token no implementado | alto — la sesión expira a los 15 min sin UI de error | antes de ship a usuarios reales |
| 2 | Refresh token en localStorage (demo) — producción requiere httpOnly cookie | alto | antes de ship |
| 3 | Rate limiting en /auth/login no implementado | medio | antes de ship |
| 4 | Tests de integración de repositorios contra DB real pendientes | medio | antes de ship |
