# TDD Plan UI: hrms-auth-roles

**Feature**: Login, guards, shell, gestión de roles — frontend Angular 17
**Spec de origen**: docs/specs/hrms-auth-roles.spec.md
**Arch de origen**: docs/specs/hrms-auth-roles.arch.md
**Fecha**: 2026-06-12
**Framework UI**: Angular 17 standalone + Jasmine + TestBed
**Total de tests planificados**: 38

---

## Resumen

| Artefacto | Tipo | Tests |
|---|---|---|
| AuthService | Servicio (unitario con HttpClientTesting) | 10 |
| AuthGuard | Guard funcional | 2 |
| PermissionGuard | Guard funcional | 4 |
| LoginComponent | Smart | 8 |
| ShellComponent | Smart | 6 |
| RolesComponent | Smart | 5 |
| RoleFormComponent | Dumb | 3 |
| **Total** | | **38** |

---

## Clasificación de componentes

| Artefacto | Tipo | Responsabilidad | Dependencias |
|---|---|---|---|
| `AuthService` | Servicio | Estado de auth, login/logout/refresh, hasPermission | `HttpClient`, `Router`, `signal` interno |
| `AuthGuard` | Guard funcional | Bloquea rutas si no autenticado | `AuthService` |
| `PermissionGuard` | Guard funcional | Bloquea por módulo+acción | `AuthService`, `Router` |
| `LoginComponent` | Smart | Formulario reactivo, submit, redirect | `AuthService`, `Router`, `TranslateService` |
| `ShellComponent` | Smart | Sidebar filtrado por permisos, idioma, logout | `AuthService`, `TranslateService`, `Router` |
| `RolesComponent` | Smart | Lista + CRUD de roles | `RolesApiService`, `AuthService` |
| `RoleFormComponent` | Dumb | Form con checkboxes de permisos | inputs/outputs solamente |

---

## Estados visuales por componente

| Componente | IDLE | LOADING | SUCCESS | ERROR | EMPTY |
|---|---|---|---|---|---|
| `LoginComponent` | ✅ | ✅ | ✅ (redirect) | ✅ | ❌ n/a |
| `ShellComponent` | ✅ | ❌ n/a | ✅ | ❌ n/a | ❌ n/a |
| `RolesComponent` | ❌ n/a | ✅ | ✅ | ✅ | ✅ |
| `RoleFormComponent` | ✅ | ❌ n/a | ✅ (emit) | ✅ (invalid) | ❌ n/a |

---

## Plan por artefacto

### AuthService

Archivo de tests: `apps/hrms-ui/src/app/auth/auth.service.spec.ts`

Setup:
```typescript
TestBed.configureTestingModule({
  providers: [AuthService, provideHttpClientTesting()]
})
const service = TestBed.inject(AuthService)
const httpMock = TestBed.inject(HttpTestingController)
```

---

#### Test S.1
- **Nombre**: `given_no_stored_session_when_getCurrentUser_then_returns_null()`
- **Tipo**: unitario de servicio
- **Arrange**: servicio recién instanciado
- **Act**: `service.currentUser()`
- **Assert**: retorna `null` (o el signal está en `null`)

---

#### Test S.2
- **Nombre**: `given_valid_credentials_when_login_then_stores_AuthenticatedUser_in_signal()`
- **Tipo**: unitario de servicio
- **Arrange**: HTTP mock retorna `{ access_token, refresh_token, user: AuthenticatedUser }`
- **Act**: `await service.login({ email, password })`
- **Assert**: `service.currentUser()` tiene el shape exacto de `AuthenticatedUser` — id, email, role, role.permissions array
- **⚠️ Test de contrato congelado**: verifica que `AuthenticatedUser` se mapea correctamente desde la respuesta HTTP

---

#### Test S.3
- **Nombre**: `given_invalid_credentials_when_login_then_throws_and_currentUser_remains_null()`
- **Tipo**: unitario de servicio
- **Arrange**: HTTP mock retorna 401
- **Act**: `service.login({ email, wrongPassword })`
- **Assert**: lanza error; `service.currentUser()` sigue siendo `null`

---

#### Test S.4
- **Nombre**: `given_super_admin_user_when_hasPermission_called_with_any_module_and_action_then_returns_true()`
- **Tipo**: unitario de servicio — verifica invariante super_admin
- **Arrange**: `service.currentUser()` es un `AuthenticatedUser` con rol `super_admin`
- **Act**: `service.hasPermission(AppModule.PAYROLL, 'canDelete')` (módulo y acción restrictivos)
- **Assert**: `true`

---

#### Test S.5
- **Nombre**: `given_hr_manager_user_when_hasPermission_for_allowed_module_then_returns_true()`
- **Tipo**: unitario de servicio
- **Arrange**: user con `{ module: AppModule.EMPLOYEES, canView: true, canCreate: false }`
- **Act**: `service.hasPermission(AppModule.EMPLOYEES, 'canView')`
- **Assert**: `true`

---

#### Test S.6
- **Nombre**: `given_hr_manager_user_when_hasPermission_for_denied_action_then_returns_false()`
- **Tipo**: unitario de servicio
- **Arrange**: user con `{ module: AppModule.EMPLOYEES, canView: true, canCreate: false }`
- **Act**: `service.hasPermission(AppModule.EMPLOYEES, 'canCreate')`
- **Assert**: `false`

---

#### Test S.7
- **Nombre**: `given_authenticated_user_when_logout_then_currentUser_becomes_null()`
- **Tipo**: unitario de servicio
- **Arrange**: usuario autenticado en el signal
- **Act**: `service.logout()`; flush HTTP de logout
- **Assert**: `service.currentUser()` === `null`

---

#### Test S.8
- **Nombre**: `given_valid_refresh_token_when_refreshToken_then_updates_access_token_in_session()`
- **Tipo**: unitario de servicio
- **Arrange**: token expirado almacenado; HTTP mock retorna nuevo `access_token`
- **Act**: `await service.refreshToken()`
- **Assert**: el nuevo `access_token` está almacenado (sesión continúa activa)

---

#### Test S.9
- **Nombre**: `given_expired_refresh_token_when_refreshToken_then_calls_logout_and_redirects_to_login()`
- **Tipo**: unitario de servicio
- **Arrange**: HTTP mock retorna 401 en `/auth/refresh`; mock de `Router.navigate`
- **Act**: `await service.refreshToken()`
- **Assert**: `Router.navigate` llamado con `['/login']`

---

#### Test S.10
- **Nombre**: `AppModule_enum_values_are_used_in_hasPermission_not_string_literals()`
- **Tipo**: unitario de servicio — test de contrato congelado
- **Arrange**: importar `AppModule` desde `@hrms/core/contracts/roles`
- **Act**: `service.hasPermission(AppModule.EMPLOYEES, 'canView')` — usando enum, no `'employees'`
- **Assert**: funciona correctamente → el servicio espera el enum, no strings
- **⚠️ Alerta**: Si alguien cambia el valor del enum, este test falla aunque la lógica "parezca" funcionar

---

### AuthGuard

Archivo de tests: `apps/hrms-ui/src/app/auth/guards/auth.guard.spec.ts`

---

#### Test G.1
- **Nombre**: `given_unauthenticated_user_when_accessing_protected_route_then_redirects_to_login()`
- **Tipo**: unitario de guard
- **Arrange**: `AuthService.currentUser()` retorna `null`; mock de `Router`
- **Act**: ejecutar el guard con `ActivatedRouteSnapshot` y `RouterStateSnapshot`
- **Assert**: retorna `UrlTree` equivalente a `/login`

---

#### Test G.2
- **Nombre**: `given_authenticated_user_when_accessing_protected_route_then_returns_true()`
- **Tipo**: unitario de guard
- **Arrange**: `AuthService.currentUser()` retorna `AuthenticatedUser` válido
- **Act**: ejecutar el guard
- **Assert**: retorna `true`

---

### PermissionGuard

Archivo de tests: `apps/hrms-ui/src/app/auth/guards/permission.guard.spec.ts`

---

#### Test P.1
- **Nombre**: `given_user_with_employees_canView_permission_when_guard_checks_then_returns_true()`
- **Tipo**: unitario de guard
- **Arrange**: user con `canView=true` en `AppModule.EMPLOYEES`
- **Act**: `permissionGuard(AppModule.EMPLOYEES, 'canView')`
- **Assert**: `true`

---

#### Test P.2
- **Nombre**: `given_user_without_employees_canCreate_when_guard_checks_then_redirects_to_forbidden()`
- **Tipo**: unitario de guard
- **Arrange**: user con `canCreate=false` en `AppModule.EMPLOYEES`; mock `Router`
- **Act**: `permissionGuard(AppModule.EMPLOYEES, 'canCreate')`
- **Assert**: retorna `UrlTree` equivalente a `/forbidden`

---

#### Test P.3
- **Nombre**: `given_super_admin_when_guard_checks_any_module_then_returns_true()`
- **Tipo**: unitario de guard — invariante super_admin en capa UI
- **Arrange**: user con rol `super_admin`
- **Act**: `permissionGuard(AppModule.PAYROLL, 'canDelete')`
- **Assert**: `true` — nunca redirige al super_admin

---

#### Test P.4
- **Nombre**: `given_unauthenticated_user_when_permission_guard_runs_then_redirects_to_login()`
- **Tipo**: unitario de guard
- **Arrange**: `AuthService.currentUser()` retorna `null`
- **Act**: `permissionGuard(AppModule.EMPLOYEES, 'canView')`
- **Assert**: retorna `UrlTree` de `/login` — no `/forbidden` (el usuario no está logueado)

---

### LoginComponent — Smart

Archivo de tests: `apps/hrms-ui/src/app/auth/login/login.component.spec.ts`

Setup:
```typescript
await TestBed.configureTestingModule({
  imports: [LoginComponent, ReactiveFormsModule, TranslateModule.forRoot(), RouterTestingModule],
  providers: [{ provide: AuthService, useValue: mockAuthService }]
}).compileComponents()
const fixture = TestBed.createComponent(LoginComponent)
const compiled = fixture.nativeElement
```

---

#### Test L.1
- **Nombre**: `given_component_renders_then_shows_email_and_password_fields()`
- **Tipo**: unitario de render
- **Arrange**: componente inicializado
- **Act**: `fixture.detectChanges()`
- **Assert**: `compiled.querySelector('[formControlName="email"]')` existe; ídem `password`

---

#### Test L.2
- **Nombre**: `given_i18n_configured_when_component_renders_then_title_uses_translation_key()`
- **Tipo**: unitario de render — test de contrato i18n congelado
- **Arrange**: `TranslateService` con traducciones cargadas para `auth.login.title`
- **Act**: `fixture.detectChanges()`
- **Assert**: el título del componente muestra el valor traducido, no la key literal
- **⚠️ Alerta**: Si el componente hardcodea el texto, este test falla → protege contra strings no-i18n

---

#### Test L.3
- **Nombre**: `given_empty_form_when_user_submits_then_shows_required_validation_errors()`
- **Tipo**: unitario de interacción
- **Arrange**: formulario vacío
- **Act**: click en botón de submit
- **Assert**: mensajes de error de validación visibles para email y password

---

#### Test L.4
- **Nombre**: `given_invalid_email_format_when_user_types_then_shows_email_format_error()`
- **Tipo**: unitario de interacción
- **Arrange**: `emailControl.setValue('notanemail')`
- **Act**: `emailControl.markAsTouched()`, `fixture.detectChanges()`
- **Assert**: mensaje de error de formato de email visible

---

#### Test L.5
- **Nombre**: `given_valid_credentials_when_user_submits_then_calls_authService_login()`
- **Tipo**: unitario con mock
- **Arrange**: form con `email` y `password` válidos; `mockAuthService.login` retorna Promise resuelto
- **Act**: click en submit
- **Assert**: `mockAuthService.login` llamado con `{ email, password }`

---

#### Test L.6
- **Nombre**: `given_successful_login_when_authService_resolves_then_navigates_to_dashboard()`
- **Tipo**: unitario con mock
- **Arrange**: `mockAuthService.login` retorna Promise resuelto; mock de `Router.navigate`
- **Act**: submit del formulario
- **Assert**: `Router.navigate` llamado con `['/dashboard']`

---

#### Test L.7
- **Nombre**: `given_login_fails_when_authService_rejects_then_shows_error_message()`
- **Tipo**: unitario con mock
- **Arrange**: `mockAuthService.login` lanza error (401)
- **Act**: submit del formulario
- **Assert**: mensaje de error visible en el template (ej: `translate.instant('auth.login.error.invalid_credentials')`)

---

#### Test L.8
- **Nombre**: `while_login_is_loading_then_submit_button_is_disabled()`
- **Tipo**: unitario de estado
- **Arrange**: `mockAuthService.login` retorna Promise que no resuelve (pending)
- **Act**: click en submit; `fixture.detectChanges()`
- **Assert**: botón de submit tiene atributo `disabled`

---

### ShellComponent — Smart

Archivo de tests: `apps/hrms-ui/src/app/shell/shell.component.spec.ts`

---

#### Test SH.1
- **Nombre**: `given_hr_manager_user_when_shell_renders_then_sidebar_shows_only_permitted_modules()`
- **Tipo**: unitario con mock
- **Arrange**: user con `canView=true` en `EMPLOYEES`, `DOCUMENTS`; `canView=false` en `PAYROLL`, `REPORTS`
- **Act**: `fixture.detectChanges()`
- **Assert**: items de sidebar para EMPLOYEES y DOCUMENTS visibles; PAYROLL y REPORTS no presentes en el DOM

---

#### Test SH.2
- **Nombre**: `given_super_admin_when_shell_renders_then_all_module_links_are_in_sidebar()`
- **Tipo**: unitario con mock
- **Arrange**: user `super_admin`
- **Act**: `fixture.detectChanges()`
- **Assert**: 11 links en sidebar (uno por cada `AppModule`)

---

#### Test SH.3
- **Nombre**: `when_user_selects_spanish_in_language_selector_then_calls_translateService_use_with_es()`
- **Tipo**: unitario de interacción
- **Arrange**: componente renderizado; mock de `TranslateService`
- **Act**: seleccionar `es` en el selector de idioma
- **Assert**: `mockTranslateService.use` llamado con `'es'`

---

#### Test SH.4
- **Nombre**: `when_user_clicks_logout_then_calls_authService_logout()`
- **Tipo**: unitario de interacción
- **Arrange**: componente renderizado; mock de `AuthService`
- **Act**: click en botón de logout
- **Assert**: `mockAuthService.logout` llamado

---

#### Test SH.5
- **Nombre**: `when_logout_completes_then_navigates_to_login()`
- **Tipo**: unitario de interacción
- **Arrange**: `mockAuthService.logout` resuelve correctamente; mock de `Router`
- **Act**: click en logout
- **Assert**: `Router.navigate` llamado con `['/login']`

---

#### Test SH.6
- **Nombre**: `given_authenticated_user_when_shell_renders_then_shows_user_email_in_header()`
- **Tipo**: unitario de render
- **Arrange**: user con `email: 'test@example.com'`
- **Act**: `fixture.detectChanges()`
- **Assert**: `test@example.com` visible en el header

---

### RolesComponent — Smart

Archivo de tests: `apps/hrms-ui/src/app/roles/roles.component.spec.ts`

---

#### Test R.1
- **Nombre**: `while_roles_are_loading_then_shows_loading_indicator()`
- **Tipo**: unitario de estado
- **Arrange**: `mockRolesApiService.getRoles` retorna Observable que no ha emitido
- **Act**: `fixture.detectChanges()`
- **Assert**: spinner/skeleton loader visible; tabla no visible

---

#### Test R.2
- **Nombre**: `given_service_returns_roles_when_initialized_then_renders_role_list()`
- **Tipo**: unitario con mock
- **Arrange**: `mockRolesApiService.getRoles` emite `[hrManager, finance, employee]`
- **Act**: `fixture.detectChanges()`
- **Assert**: 3 filas en la tabla (o items en la lista)

---

#### Test R.3
- **Nombre**: `given_empty_roles_list_when_initialized_then_shows_empty_state_message()`
- **Tipo**: unitario de estado
- **Arrange**: `mockRolesApiService.getRoles` emite `[]`
- **Act**: `fixture.detectChanges()`
- **Assert**: mensaje de estado vacío visible (ej: `translate.instant('roles.empty')`)

---

#### Test R.4
- **Nombre**: `given_api_error_when_loading_roles_then_shows_error_message()`
- **Tipo**: unitario de estado
- **Arrange**: `mockRolesApiService.getRoles` lanza error HTTP
- **Act**: `fixture.detectChanges()`
- **Assert**: mensaje de error visible; spinner no visible

---

#### Test R.5
- **Nombre**: `given_system_role_in_list_when_rendered_then_delete_button_is_disabled_or_absent()`
- **Tipo**: unitario de render — verifica invariante `is_system` en UI
- **Arrange**: lista con un rol `is_system=true` y otro `is_system=false`
- **Act**: `fixture.detectChanges()`
- **Assert**: botón eliminar del rol de sistema está deshabilitado o no existe; el del rol normal está habilitado

---

### RoleFormComponent — Dumb

Archivo de tests: `apps/hrms-ui/src/app/roles/role-form/role-form.component.spec.ts`

---

#### Test RF.1
- **Nombre**: `given_no_initial_role_when_rendered_then_shows_empty_name_field_and_all_permission_checkboxes()`
- **Tipo**: unitario de render
- **Arrange**: `@Input() role = null`
- **Act**: `fixture.detectChanges()`
- **Assert**: campo de nombre vacío; número de checkboxes = 11 módulos × 5 acciones = **55 checkboxes**
- **⚠️ Test de contrato congelado**: Si `AppModule` crece de 11 a 12 módulos, este test fallará, alertando que el form debe actualizarse

---

#### Test RF.2
- **Nombre**: `given_empty_name_when_user_submits_then_emits_nothing_and_shows_validation_error()`
- **Tipo**: unitario de interacción
- **Arrange**: componente sin nombre; spy en output `(save)`
- **Act**: click en botón guardar
- **Assert**: output `save` NO emitió nada; error de validación de nombre visible

---

#### Test RF.3
- **Nombre**: `given_valid_form_when_user_submits_then_emits_save_with_role_data()`
- **Tipo**: unitario de interacción
- **Arrange**: nombre `'Supervisor'`; 3 checkboxes marcados; spy en `(save)`
- **Act**: click en guardar
- **Assert**: `save` emitió objeto `{ name: 'Supervisor', permissions: [...] }` con exactamente los 3 permisos en `true`

---

## Tests de segunda prioridad

Tests útiles para robustecer la suite, no bloqueantes para primera entrega:

- `given_super_admin_role_passed_as_input_when_rendered_then_all_checkboxes_are_checked_and_disabled()` — muestra la invariante en la UI pero requiere lógica adicional en el componente
- `given_language_es_when_login_renders_then_placeholder_uses_spanish_translation()` — cubre variante de idioma del formulario
- `when_refresh_token_interceptor_detects_401_then_calls_authService_refreshToken()` — requiere configurar el HTTP interceptor en TestBed; importante pero separado del flujo principal
- `given_user_navigates_directly_to_forbidden_route_then_auth_guard_preserves_redirect_url()` — cubre el parámetro `returnUrl` post-login

---

## Tests excluidos y motivo

| Test candidato | Motivo de exclusión |
|---|---|
| Verificar colores del sidebar activo/inactivo | Detalle visual; no comportamiento |
| Snapshot del LoginComponent | Snapshot testing es complementario — frágil ante cambios de markup |
| Test del pipe `translate` en sí | El pipe es de `@ngx-translate` — no se testea código de terceros |
| Animaciones del sidebar | CSS/animation testing fuera del scope de comportamiento |
| Responsive layout del shell | Testing visual — requiere herramientas específicas (Cypress, Percy) |
| E2E flujo completo login→dashboard | Scope del sub-spec de e2e (no planificado en v1) |

---

## ⚠️ Alertas de diseño

**RF.1** (conteo de 55 checkboxes): Esta cifra depende exactamente del número de valores en `AppModule`. Si el backend agrega un módulo y el frontend no actualiza el formulario, este test falla — ese es el comportamiento deseado. No hardcodear el número 55 en el test: calcular como `Object.values(AppModule).length * 5`.

**L.2** (test de i18n): Si el componente usa `{{ 'auth.login.title' | translate }}` en el template, el test funciona. Si hardcodea `'Iniciar Sesión'`, el test falla aunque la UI se vea correctamente en español. El test protege la correcta adopción de i18n.

---

## Próximo paso

Continuar con `/why` para documentar el motivo de cada cambio antes de hacer commit.
