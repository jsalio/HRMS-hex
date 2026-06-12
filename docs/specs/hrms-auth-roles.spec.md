# SDD Spec: hrms-auth-roles

**Feature**: Autenticación JWT + gestión de roles y permisos + app shell con i18n
**User story**: Como usuario quiero iniciar sesión con email y contraseña y acceder solo a los módulos que mi rol permite
**Estado**: Draft
**Fecha**: 2026-06-12
**Parte de**: hrms-hex.split.md — Sub-spec 1 de 10
**Dependencias**: ninguna (base del sistema)

---

## Decisiones fijas

| Decisión | Valor |
|---|---|
| Auth | JWT — access token (15min) + refresh token (7d) |
| Roles del sistema | super_admin, hr_manager, finance, employee (is_system=true, no eliminables) |
| Permisos | View/Create/Edit/Delete/Export por módulo |
| 2FA | Configurable por rol (require_2fa); implementación: TOTP en v1 |
| i18n setup | @ngx-translate/core instalado aquí — heredado por todos los sub-specs |
| Idiomas | es (default), en, pt — selector en header, persistido en localStorage key `hrms_lang` |
| App shell | Sidebar con navegación por módulo + header con usuario + selector de idioma |
| Login UI | Diseño mínimo coherente con tema Stitch (#0f49bd, Inter, border-radius 8px) |

---

## Modelo de datos

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module     VARCHAR(50) NOT NULL
             CHECK (module IN ('dashboard','employees','attendance','payroll',
                               'reports','settings','documents','absences',
                               'benefits','recruitment','notifications')),
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       UUID NOT NULL REFERENCES roles(id),
  employee_id   UUID,  -- FK a employees.id, se agrega en hrms-employees
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed inicial
INSERT INTO roles (name, description, is_system) VALUES
  ('super_admin', 'Full system access', true),
  ('hr_manager',  'Recruitment & Employee life-cycle', true),
  ('finance',     'Payroll, Taxes & Invoicing', true),
  ('employee',    'Self-service limited access', true);
```

### Invariantes del modelo
1. Un rol con `is_system = true` no puede ser eliminado ni renombrado.
2. El rol `super_admin` siempre tiene todos los permisos en `true` — se recalcula al leer.
3. Un usuario con `is_active = false` no puede autenticarse aunque las credenciales sean válidas.
4. Solo puede existir un refresh_token activo por usuario (revoca el anterior al renovar).

---

## Contratos de API

### Auth endpoints

**POST /auth/login**
```
Body:    { email: string, password: string }
Response 200: {
  access_token: string,   // JWT, exp 15min
  refresh_token: string,  // opaco, exp 7d
  user: { id, email, role: { id, name, permissions: RolePermission[] } }
}
Efecto: crea refresh_token, actualiza last_login_at
Errores: 401 credenciales inválidas | 401 usuario inactivo
```

**POST /auth/refresh**
```
Body:    { refresh_token: string }
Response 200: { access_token: string }
Efecto: rota refresh_token (invalida el anterior, crea uno nuevo)
Errores: 401 token expirado | 401 token revocado
```

**POST /auth/logout**
```
Headers: Authorization: Bearer <access_token>
Response 204
Efecto: revoca refresh_token del usuario
```

### Roles endpoints

**GET /roles**
```
Response 200: Role[]
Requiere: can_view en módulo 'settings'
```

**POST /roles**
```
Body:    { name, description?, require_2fa?, permissions: PermissionInput[] }
Response 201: Role
Efecto: crea role + role_permissions
Errores: 409 nombre duplicado | 403 sin permiso
```

**PATCH /roles/:id**
```
Body:    { description?, require_2fa?, permissions?: PermissionInput[] }
Response 200: Role
Efecto: actualiza role y sus permissions
Errores: 422 is_system (name no editable) | 403
```

**DELETE /roles/:id**
```
Response 204
Efecto: elimina role y role_permissions
Errores: 422 is_system | 409 usuarios asignados a este rol | 403
```

### Users endpoints

**GET /users**
```
Response 200: User[] (sin password_hash)
Requiere: can_view en 'settings'
```

**POST /users**
```
Body:    { email, password, role_id }
Response 201: User
Efecto: crea user con password hasheado (bcrypt cost 12)
Errores: 409 email duplicado | 404 role no existe | 403
```

**PATCH /users/:id/deactivate**
```
Response 200: User
Efecto: is_active → false, revoca refresh_tokens activos
Errores: 422 no puede desactivarse a sí mismo | 403
```

---

## Máquina de estados del frontend

### App shell
```
LOADING_CONFIG
  → [i18n cargado + auth verificado] → AUTHENTICATED_SHELL
  → [sin token / token expirado]     → LOGIN_PAGE

LOGIN_PAGE
  → [credenciales válidas]    → AUTHENTICATED_SHELL
  → [credenciales inválidas]  → LOGIN_PAGE (error visible)

AUTHENTICATED_SHELL
  → sidebar con links filtrados por role_permissions del usuario
  → [token por expirar → /auth/refresh automático]
  → [logout] → LOGIN_PAGE
```

### Gestión de roles (Admin)
```
ROLES_LIST
  → [+ nuevo rol]    → CREATE_FORM
  → [editar rol]     → EDIT_FORM
  → [eliminar rol]   → CONFIRM_DELETE_MODAL
CREATE_FORM / EDIT_FORM
  → permission matrix (checkbox por módulo×acción)
  → [guardar]        → ROLES_LIST actualizado
  → [cancelar]       → ROLES_LIST
```

---

## Invariantes del sistema

| # | Invariante |
|---|---|
| 1 | super_admin siempre tiene todos los permisos activos |
| 2 | Roles is_system no pueden ser eliminados (422) |
| 3 | Usuario inactivo → 401 en cualquier endpoint autenticado |
| 4 | Access token expirado → interceptor Angular renueva automáticamente con refresh token |
| 5 | Ningún texto hardcodeado en templates Angular — todo via `\| translate` |

---

## Impacto en archivos

| Archivo | Cambio |
|---|---|
| `packages/core/src/contracts/auth.ts` | NUEVO — interfaces IAuthService, ITokenService, IUserRepository |
| `packages/core/src/contracts/roles.ts` | NUEVO — interfaces IRoleRepository, IPermissionService |
| `packages/core/src/domain/role.ts` | NUEVO — entidad Role con invariante super_admin |
| `packages/core/src/domain/user.ts` | NUEVO — entidad User |
| `packages/core/src/usecases/login.usecase.ts` | NUEVO |
| `packages/core/src/usecases/refresh-token.usecase.ts` | NUEVO |
| `packages/core/src/usecases/manage-roles.usecase.ts` | NUEVO |
| `packages/boundary-postgres/src/repositories/user.repository.ts` | NUEVO |
| `packages/boundary-postgres/src/repositories/role.repository.ts` | NUEVO |
| `packages/boundary-postgres/migrations/001_auth_roles.sql` | NUEVO |
| `packages/api/src/controllers/auth.controller.ts` | NUEVO |
| `packages/api/src/controllers/roles.controller.ts` | NUEVO |
| `packages/api/src/middleware/auth.middleware.ts` | NUEVO — JWT verify |
| `packages/api/src/middleware/permission.middleware.ts` | NUEVO |
| `apps/hrms-ui/src/app/app.module.ts` | NUEVO — TranslateModule configurado |
| `apps/hrms-ui/src/app/shell/` | NUEVO — sidebar + header Smart component |
| `apps/hrms-ui/src/app/auth/login/` | NUEVO — Smart + Dumb login |
| `apps/hrms-ui/src/app/roles/` | NUEVO — roles list + form |
| `apps/hrms-ui/src/assets/i18n/es.json` | NUEVO — claves auth + roles + common |
| `apps/hrms-ui/src/assets/i18n/en.json` | NUEVO |
| `apps/hrms-ui/src/assets/i18n/pt.json` | NUEVO |

---

## Fuera de scope

- OAuth / SSO (v2)
- Autenticación biométrica
- Audit log de accesos (hrms-admin)
- Recuperación de contraseña por email (v2)
- Gestión de sesiones múltiples por usuario
