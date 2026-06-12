# TDD Plan: hrms-auth-roles

**Feature**: Autenticación JWT + roles/permisos + app shell i18n — backend
**Spec de origen**: docs/specs/hrms-auth-roles.spec.md
**Arch de origen**: docs/specs/hrms-auth-roles.arch.md
**Fecha**: 2026-06-12
**Framework**: Bun test (API compatible con Jest)
**Total de tests planificados**: 40

---

## Resumen

| Capa | Tipo | Cantidad |
|---|---|---|
| Domain — Role, User entities | Unitario puro | 8 |
| Application — LoginUseCase, RefreshTokenUseCase, ManageRolesUseCase | Unitario con mocks | 14 |
| Infrastructure — UserRepository, RoleRepository | Integración (DB real) | 9 |
| API — controllers + middleware | Integración HTTP | 9 |
| **Total** | | **40** |

---

## Cobertura de invariantes

| # | Invariante del spec | Test asignado |
|---|---|---|
| 1 | Rol `is_system = true` no puede eliminarse ni renombrarse | `given_system_role_when_rename_then_throws_DomainError` + `given_system_role_when_delete_then_throws_DomainError` |
| 2 | `super_admin` siempre tiene todos los permisos en `true` | `given_super_admin_role_when_reading_permissions_then_all_are_true` + `given_super_admin_when_update_permissions_then_all_remain_true` |
| 3 | Usuario `is_active = false` no puede autenticarse | `given_inactive_user_when_login_then_throws_UnauthorizedError` + `given_inactive_user_when_POST_login_then_returns_401` |
| 4 | Solo un refresh_token activo por usuario (rota al renovar) | `given_valid_refresh_token_when_refresh_then_old_token_is_revoked` |
| 5 | `AuthenticatedUser` shape exacto en response de login | `given_valid_login_when_POST_login_then_response_has_AuthenticatedUser_shape` |
| 6 | `AppModule` enum values coinciden con CHECK constraint de DB | `AppModule_enum_values_match_database_constraint_values` |

---

## Secuencia de implementación

### Iteración 1 — Dominio (sin DB, sin HTTP, sin mocks)

Archivo de tests: `packages/core/src/__tests__/domain/role.test.ts`
                  `packages/core/src/__tests__/domain/user.test.ts`

---

#### Test 1.1
- **Nombre**: `given_role_with_super_admin_name_when_reading_permissions_then_all_are_true()`
- **Tipo**: unitario puro
- **Arrange**: `const role = new Role({ name: 'super_admin', isSystem: true, permissions: [] })`
- **Act**: `const perms = role.toAuthPermissions()`
- **Assert**: cada entrada de `perms` tiene `canView/canCreate/canEdit/canDelete/canExport = true` para todos los `AppModule` values
- **Implementación mínima para GREEN**: clase `Role` con método `toAuthPermissions()` que devuelve todos `true` cuando `name === 'super_admin'`

---

#### Test 1.2
- **Nombre**: `given_non_super_admin_role_when_reading_permissions_then_returns_stored_permissions()`
- **Tipo**: unitario puro
- **Arrange**: role `hr_manager` con `canView=true` en `EMPLOYEES`, resto `false`
- **Act**: `role.toAuthPermissions()`
- **Assert**: retorna exactamente los permisos almacenados, sin sobrescribir
- **Implementación mínima para GREEN**: `toAuthPermissions()` distingue `super_admin` del resto

---

#### Test 1.3
- **Nombre**: `given_system_role_when_attempting_rename_then_throws_DomainError()`
- **Tipo**: unitario puro
- **Arrange**: `const role = new Role({ name: 'hr_manager', isSystem: true })`
- **Act**: `role.rename('nuevo_nombre')`
- **Assert**: lanza `DomainError` con mensaje que incluye "system role"
- **Implementación mínima para GREEN**: método `rename()` con guard `if (this.isSystem) throw new DomainError(...)`

---

#### Test 1.4
- **Nombre**: `given_system_role_when_attempting_delete_then_throws_DomainError()`
- **Tipo**: unitario puro
- **Arrange**: `const role = new Role({ isSystem: true })`
- **Act**: `role.assertCanDelete()`
- **Assert**: lanza `DomainError`
- **Implementación mínima para GREEN**: método `assertCanDelete()` con guard `is_system`

---

#### Test 1.5
- **Nombre**: `given_super_admin_role_when_update_permissions_called_then_all_permissions_remain_true()`
- **Tipo**: unitario puro
- **Arrange**: role `super_admin` con `canView=false` en algún módulo (simulando un intento de restricción)
- **Act**: `role.toAuthPermissions()`
- **Assert**: aun así devuelve `canView=true` — la invariante override los permisos almacenados
- **Implementación mínima para GREEN**: la invariante vive en `toAuthPermissions()`, no en los datos

---

#### Test 1.6
- **Nombre**: `given_active_user_when_assertCanAuthenticate_then_does_not_throw()`
- **Tipo**: unitario puro
- **Arrange**: `const user = new User({ isActive: true })`
- **Act**: `user.assertCanAuthenticate()`
- **Assert**: no lanza ninguna excepción
- **Implementación mínima para GREEN**: clase `User` con método `assertCanAuthenticate()`

---

#### Test 1.7
- **Nombre**: `given_inactive_user_when_assertCanAuthenticate_then_throws_UnauthorizedError()`
- **Tipo**: unitario puro
- **Arrange**: `const user = new User({ isActive: false })`
- **Act**: `user.assertCanAuthenticate()`
- **Assert**: lanza `UnauthorizedError`
- **Implementación mínima para GREEN**: `if (!this.isActive) throw new UnauthorizedError(...)`

---

#### Test 1.8
- **Nombre**: `AppModule_enum_values_match_expected_strings()`
- **Tipo**: unitario puro — test de contrato congelado
- **Arrange**: importar `AppModule` de `@hrms/core/contracts/roles`
- **Act**: leer los valores del enum
- **Assert**: `AppModule.EMPLOYEES === 'employees'`, `AppModule.PAYROLL === 'payroll'`, etc. — los 11 valores exactos del CHECK constraint de DB
- **⚠️ Alerta**: Si este test falla después de estar verde, significa que alguien cambió el contrato congelado. Es el test de regresión más importante del sub-spec #1.

---

### Iteración 2 — Casos de uso (mocks de repositorios)

Archivo de tests: `packages/core/src/__tests__/usecases/login.usecase.test.ts`
                  `packages/core/src/__tests__/usecases/refresh-token.usecase.test.ts`
                  `packages/core/src/__tests__/usecases/manage-roles.usecase.test.ts`

Estrategia de mocks: objetos literales con las mismas firmas que las interfaces — sin librerías de mock.

```typescript
// Mock pattern usado en todos los tests de use cases
const mockUserRepo: IUserRepository = {
  findByEmail: mock(() => Promise.resolve(null)),
  findById: mock(() => Promise.resolve(null)),
  create: mock(() => Promise.resolve(fakeUser)),
  deactivate: mock(() => Promise.resolve(fakeUser)),
  setEmployee: mock(() => Promise.resolve()),
}
```

---

#### Test 2.1
- **Nombre**: `given_valid_credentials_when_login_then_returns_tokens_and_authenticated_user()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockUserRepo.findByEmail` retorna usuario activo con rol y permisos; `mockTokenSvc` retorna tokens; password hash válido
- **Act**: `await loginUseCase.execute({ email, password })`
- **Assert**: retorna `{ access_token, refresh_token, user: AuthenticatedUser }` con el shape exacto del contrato
- **Mocks necesarios**: `IUserRepository`, `IRoleRepository`, `ITokenService`
- **Implementación mínima para GREEN**: `LoginUseCase.execute()` que llama a `findByEmail`, verifica password, genera tokens

---

#### Test 2.2
- **Nombre**: `given_valid_login_when_execute_then_AuthenticatedUser_has_exact_contract_shape()`
- **Tipo**: unitario con mocks — test de contrato congelado
- **Arrange**: usuario activo con role `hr_manager` con permisos específicos
- **Act**: `const result = await loginUseCase.execute({ email, password })`
- **Assert**: `result.user` tiene exactamente `{ id, email, role: { id, name, permissions: [{ module, canView, canCreate, canEdit, canDelete, canExport }] } }` — ningún campo extra, ninguno faltante
- **⚠️ Alerta**: Este test congela el shape del JWT payload. Cualquier cambio futuro romperá esto.

---

#### Test 2.3
- **Nombre**: `given_invalid_password_when_login_then_throws_UnauthorizedError()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockUserRepo.findByEmail` retorna usuario; password que no coincide con el hash
- **Act**: `loginUseCase.execute({ email, wrongPassword })`
- **Assert**: lanza `UnauthorizedError`

---

#### Test 2.4
- **Nombre**: `given_unknown_email_when_login_then_throws_UnauthorizedError()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockUserRepo.findByEmail` retorna `null`
- **Act**: `loginUseCase.execute({ unknownEmail, password })`
- **Assert**: lanza `UnauthorizedError` — **mismo error que contraseña inválida** (no revelar si el email existe)

---

#### Test 2.5
- **Nombre**: `given_inactive_user_when_login_then_throws_UnauthorizedError()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockUserRepo.findByEmail` retorna usuario con `isActive = false`
- **Act**: `loginUseCase.execute({ email, password })`
- **Assert**: lanza `UnauthorizedError`

---

#### Test 2.6
- **Nombre**: `given_valid_login_when_execute_then_refresh_token_is_created_and_stored()`
- **Tipo**: unitario con mocks
- **Arrange**: usuario válido, `mockTokenRepo.createRefreshToken` espía
- **Act**: `await loginUseCase.execute(...)`
- **Assert**: `mockTokenRepo.createRefreshToken` fue llamado con el `userId` correcto

---

#### Test 2.7
- **Nombre**: `given_valid_refresh_token_when_refresh_then_returns_new_access_token()`
- **Tipo**: unitario con mocks
- **Arrange**: token hash existe en repo, no revocado, no expirado; usuario asociado activo
- **Act**: `await refreshTokenUseCase.execute({ refreshToken })`
- **Assert**: retorna `{ access_token: string }` nuevo

---

#### Test 2.8
- **Nombre**: `given_valid_refresh_token_when_refresh_then_old_token_is_revoked_and_new_one_created()`
- **Tipo**: unitario con mocks — verifica rotación
- **Arrange**: refresh token válido
- **Act**: `await refreshTokenUseCase.execute({ refreshToken })`
- **Assert**: `mockTokenRepo.revokeToken` llamado con el token original; `mockTokenRepo.createRefreshToken` llamado con nuevo token

---

#### Test 2.9
- **Nombre**: `given_expired_refresh_token_when_refresh_then_throws_UnauthorizedError()`
- **Tipo**: unitario con mocks
- **Arrange**: token con `expires_at` en el pasado
- **Act/Assert**: lanza `UnauthorizedError`

---

#### Test 2.10
- **Nombre**: `given_revoked_refresh_token_when_refresh_then_throws_UnauthorizedError()`
- **Tipo**: unitario con mocks
- **Arrange**: token con `revoked_at` no null
- **Act/Assert**: lanza `UnauthorizedError`

---

#### Test 2.11
- **Nombre**: `given_valid_role_data_when_create_role_then_returns_role_with_permissions()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockRoleRepo.create` retorna rol creado
- **Act**: `await manageRolesUseCase.createRole({ name, permissions })`
- **Assert**: retorna `Role` con los permisos asignados

---

#### Test 2.12
- **Nombre**: `given_duplicate_role_name_when_create_then_throws_ConflictError()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockRoleRepo.findByName` retorna rol existente
- **Act/Assert**: lanza `ConflictError`

---

#### Test 2.13
- **Nombre**: `given_system_role_id_when_delete_then_throws_DomainError()`
- **Tipo**: unitario con mocks
- **Arrange**: `mockRoleRepo.findById` retorna rol con `isSystem = true`
- **Act**: `await manageRolesUseCase.deleteRole(systemRoleId)`
- **Assert**: lanza `DomainError` — el use case delega en `role.assertCanDelete()`

---

#### Test 2.14
- **Nombre**: `given_super_admin_role_when_update_permissions_then_all_permissions_remain_true()`
- **Tipo**: unitario con mocks
- **Arrange**: rol `super_admin` en repo; intento de actualizar permisos con algunos en `false`
- **Act**: `await manageRolesUseCase.updateRole(superAdminId, { permissions: [{ module: 'employees', canView: false }] })`
- **Assert**: el rol retornado tiene `canView = true` en `employees` (invariante override)

---

### Iteración 3 — Infraestructura (integración con PostgreSQL real)

Archivo de tests: `packages/boundary-postgres/src/__tests__/user.repository.test.ts`
                  `packages/boundary-postgres/src/__tests__/role.repository.test.ts`

Setup: DB de test separada; ejecutar migración `001_auth_roles.sql` en `beforeAll`; `TRUNCATE` en `beforeEach`.

```typescript
// Setup compartido
beforeAll(async () => {
  await runMigration('001_auth_roles.sql')
  await seedRoles() // super_admin, hr_manager, finance, employee
})
beforeEach(async () => {
  await sql`TRUNCATE users, refresh_tokens RESTART IDENTITY CASCADE`
})
```

---

#### Test 3.1
- **Nombre**: `given_valid_user_data_when_create_then_persists_and_returns_user_with_id()`
- **Tipo**: integración
- **Arrange**: datos de usuario válidos con role_id existente (hr_manager del seed)
- **Act**: `await userRepo.create(userData)`
- **Assert**: retorna `User` con UUID generado; `SELECT COUNT(*)` de users = 1

---

#### Test 3.2
- **Nombre**: `given_duplicate_email_when_create_then_throws_constraint_error()`
- **Tipo**: integración
- **Arrange**: crear primer usuario; mismos datos con mismo email
- **Act**: segundo `userRepo.create(...)` con mismo email
- **Assert**: lanza error con código de constraint único de Postgres (`23505`)

---

#### Test 3.3
- **Nombre**: `given_user_id_when_findById_then_returns_user_with_role_and_permissions()`
- **Tipo**: integración
- **Arrange**: usuario creado con rol `hr_manager` que tiene permisos específicos
- **Act**: `await userRepo.findById(userId)`
- **Assert**: retorna usuario con `role.permissions` cargados (JOIN)

---

#### Test 3.4
- **Nombre**: `given_unknown_id_when_findById_then_returns_null()`
- **Tipo**: integración
- **Act**: `await userRepo.findById(randomUUID())`
- **Assert**: retorna `null`

---

#### Test 3.5
- **Nombre**: `given_user_id_when_deactivate_then_sets_is_active_false_in_db()`
- **Tipo**: integración
- **Arrange**: usuario activo creado
- **Act**: `await userRepo.deactivate(userId)`
- **Assert**: `SELECT is_active FROM users WHERE id = userId` retorna `false`

---

#### Test 3.6
- **Nombre**: `given_super_admin_role_in_db_when_findById_then_all_permissions_are_true()`
- **Tipo**: integración — verifica invariante super_admin en combinación DB + dominio
- **Arrange**: seed ya insertó super_admin con `role_permissions` vacíos (o ninguno)
- **Act**: `await roleRepo.findById(superAdminId)` → `role.toAuthPermissions()`
- **Assert**: todos los permisos = `true` — el dominio aplica la invariante sobre lo que devuelve el repo

---

#### Test 3.7
- **Nombre**: `given_role_data_when_create_then_persists_role_and_permissions_atomically()`
- **Tipo**: integración
- **Arrange**: datos de rol con 3 permisos
- **Act**: `await roleRepo.create(roleData)`
- **Assert**: `SELECT COUNT(*) FROM role_permissions WHERE role_id = newRoleId` = 3

---

#### Test 3.8
- **Nombre**: `given_system_role_id_when_delete_then_throws_db_constraint_violation()`
- **Tipo**: integración
- **Arrange**: obtener id del rol `hr_manager` (is_system=true del seed)
- **Act**: DELETE directo al repo (sin pasar por el use case)
- **Assert**: lanza error — la combinación de `assertCanDelete()` en dominio + `is_system` como salvaguarda documenta que la protección es en dos capas

---

#### Test 3.9
- **Nombre**: `given_seed_roles_when_db_initialized_then_four_system_roles_exist()`
- **Tipo**: integración — verifica el seed idempotente
- **Arrange**: ejecutar el seed dos veces (`ON CONFLICT DO NOTHING`)
- **Act**: `SELECT COUNT(*) FROM roles WHERE is_system = true`
- **Assert**: = 4 (no se duplicaron)

---

### Iteración 4 — API / HTTP (integración con Hono test client)

Archivo de tests: `packages/api/src/__tests__/auth.controller.test.ts`
                  `packages/api/src/__tests__/roles.controller.test.ts`
                  `packages/api/src/__tests__/middleware/permission.middleware.test.ts`

Setup: usar `app.request()` de Hono para tests sin levantar servidor real; mocks de use cases en container de test.

---

#### Test 4.1
- **Nombre**: `given_valid_credentials_when_POST_auth_login_then_returns_200_with_tokens_and_AuthenticatedUser_shape()`
- **Tipo**: integración HTTP
- **Arrange**: mock de `loginUseCase.execute` retorna tokens + user válido
- **Act**: `POST /auth/login` con `{ email, password }`
- **Assert**: status `200`; body tiene `access_token`, `refresh_token`, `user.role.permissions` array

---

#### Test 4.2
- **Nombre**: `given_invalid_password_when_POST_auth_login_then_returns_401()`
- **Tipo**: integración HTTP
- **Arrange**: mock lanza `UnauthorizedError`
- **Act**: `POST /auth/login`
- **Assert**: status `401`; body `{ error: 'Unauthorized' }`

---

#### Test 4.3
- **Nombre**: `given_valid_refresh_token_when_POST_auth_refresh_then_returns_200_with_new_access_token()`
- **Tipo**: integración HTTP
- **Act**: `POST /auth/refresh` con `{ refresh_token }`
- **Assert**: status `200`; body `{ access_token: string }`

---

#### Test 4.4
- **Nombre**: `given_expired_token_when_POST_auth_refresh_then_returns_401()`
- **Tipo**: integración HTTP
- **Arrange**: mock lanza `UnauthorizedError`
- **Act/Assert**: status `401`

---

#### Test 4.5
- **Nombre**: `given_authenticated_user_when_POST_auth_logout_then_returns_204()`
- **Tipo**: integración HTTP
- **Arrange**: JWT válido en header Authorization
- **Act**: `POST /auth/logout`
- **Assert**: status `204`

---

#### Test 4.6
- **Nombre**: `given_user_without_settings_view_permission_when_GET_roles_then_returns_403()`
- **Tipo**: integración HTTP — verifica permission middleware
- **Arrange**: JWT con rol `employee` (canView=false en `settings`)
- **Act**: `GET /roles`
- **Assert**: status `403`

---

#### Test 4.7
- **Nombre**: `given_super_admin_when_GET_roles_then_returns_200_with_role_list()`
- **Tipo**: integración HTTP
- **Arrange**: JWT con rol `super_admin`
- **Act**: `GET /roles`
- **Assert**: status `200`; body es array de roles

---

#### Test 4.8
- **Nombre**: `given_system_role_id_when_DELETE_roles_id_then_returns_422()`
- **Tipo**: integración HTTP
- **Arrange**: mock `manageRolesUseCase.deleteRole` lanza `DomainError`
- **Act**: `DELETE /roles/:systemRoleId`
- **Assert**: status `422`

---

#### Test 4.9
- **Nombre**: `given_request_without_authorization_header_when_accessing_protected_route_then_returns_401()`
- **Tipo**: integración HTTP — verifica auth middleware
- **Act**: `GET /roles` sin header Authorization
- **Assert**: status `401`

---

## Tests de segunda prioridad

Importantes pero no bloqueantes para la primera entrega:

- `given_role_with_assigned_users_when_delete_then_returns_409()` — útil pero requiere setup extra de users en el test
- `given_request_with_malformed_jwt_when_accessing_protected_route_then_returns_401()` — cubierto implícitamente por el middleware pero vale testear explícitamente
- `given_user_deactivated_while_logged_in_when_using_valid_jwt_then_next_request_returns_401()` — requiere invalidación de tokens en vuelo; documentado como deuda técnica

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| Tests de 2FA / TOTP | Fuera de scope del comportamiento core de autenticación en v1 |
| Tests de rate limiting en login | Depende de la librería de rate limit elegida — testeada por ella misma |
| Tests del selector de idioma i18n | Cubierto en `/tdd-plan-ui` |
| Tests de `password_hash` directo | bcrypt es una librería externa — no se testea la lib, se testea que se usa |

---

## ⚠️ Alerta de diseño

El test 2.2 (`AuthenticatedUser_shape`) requiere 12+ líneas de Assert para verificar el shape completo. Esto es esperado en este caso porque es un **contrato congelado** — la verbosidad del test es intencional y deseable. No refactorizar para "simplificarlo" usando matchers parciales.

---

## Próximo paso

Continuar con `/tdd-plan-ui` para el plan de tests Angular (ShellComponent, LoginComponent, RolesComponent, guards).
