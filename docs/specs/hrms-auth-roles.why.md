# Why: hrms-auth-roles

**Feature**: Autenticación JWT + roles/permisos + app shell i18n
**Spec de origen**: docs/specs/hrms-auth-roles.spec.md
**Fecha**: 2026-06-12
**Pipeline completado**: Spec → Impact → Arch → TDD-Plan → TDD-Plan-UI → Why

---

## Contexto

### ¿Qué problema resuelve este cambio?

El sistema HRMS-HEX necesita que solo personas autorizadas accedan a información sensible de empleados, nóminas y documentos. Sin autenticación ni control de acceso, cualquier usuario podría ver la nómina de un colega, aprobar ausencias sin ser manager, o exportar expedientes completos. Este sub-spec establece quién puede entrar al sistema y qué puede hacer cada rol dentro de él.

### ¿Por qué es el primero de 10?

Los 9 sub-specs restantes necesitan saber: (1) cómo saber si un usuario está autenticado, (2) cómo verificar si tiene permiso para una acción en un módulo, y (3) cómo mostrar u ocultar elementos según sus permisos. Todo eso vive aquí. Si este sub-spec no se implementa primero, ningún otro puede proteger sus rutas ni sus endpoints.

---

## Decisiones de implementación

### Decisión 1: JWT stateless con access token 15 min + refresh token 7 días con rotación

- **Qué se decidió**: Autenticación sin estado en servidor. `access_token` de vida corta en memoria del cliente; `refresh_token` de vida larga almacenado en `httpOnly cookie` y hasheado en DB.
- **Por qué**: El sistema va a tener múltiples instancias de la API (escalabilidad horizontal). Con sesiones en servidor, todas las instancias comparten estado de sesión (requiere Redis o sesión sticky). Con JWT, cualquier instancia verifica el token localmente. El access token corto (15 min) limita la ventana de abuso si un token es interceptado. La rotación del refresh token detecta si alguien roba y usa el mismo token: el dueño legítimo al renovar invalida el robado.
- **Alternativa descartada**: Sesiones en servidor con PostgreSQL como store — más simple, pero introduce un roundtrip a DB en cada request autenticado y no escala bien horizontalmente.
- **Consecuencia**: Hay que implementar el interceptor HTTP de Angular que renueva automáticamente el access token cuando recibe un 401 con código `TOKEN_EXPIRED`. Sin él, la sesión muere a los 15 minutos.

---

### Decisión 2: AppModule enum en `@hrms/core/contracts/roles` en lugar de strings literales

- **Qué se decidió**: Todos los guards, controllers y componentes importan `AppModule` del core y usan `AppModule.EMPLOYEES` — nunca el string `'employees'` directamente.
- **Por qué**: El CHECK constraint de la tabla `role_permissions` lista los 11 módulos como strings. Si un guard escribe `'employee'` (singular) en lugar de `'employees'`, el permiso nunca va a encontrar match y el usuario siempre recibirá 403 — sin error visible, solo acceso denegado silencioso. El enum convierte ese error en un error de compilación TypeScript, detectable antes de ejecutar una sola línea.
- **Alternativa descartada**: Usar `as const` en un objeto literal — funciona igual en TypeScript pero no da el mismo autocompletado en IDEs y no es importable como tipo en expresiones `typeof AppModule`.
- **Consecuencia**: Cualquier sub-spec que necesite proteger una ruta o endpoint **debe** importar `AppModule` desde `@hrms/core`. Es una dependencia que todos los sub-specs tienen en común y no puede evitarse.

---

### Decisión 3: Invariante super_admin en `Role.toAuthPermissions()` del dominio, no en DB ni en middleware

- **Qué se decidió**: El método `toAuthPermissions()` de la entidad `Role` devuelve todos los permisos en `true` cuando `role.name === 'super_admin'`, independientemente de lo que diga `role_permissions` en DB.
- **Por qué**: Si la invariante viviera en DB (CHECK constraint o trigger), un `UPDATE` directo a `role_permissions` podría saltarla. Si viviera solo en el middleware, dos endpoints escritos por distintos sub-specs podrían olvidarse de llamar el middleware y quedar desprotegidos. Ponerla en el dominio significa que **toda** la lógica que pida permisos pasa por `toAuthPermissions()` y la invariante se cumple siempre, sin importar desde dónde se llame.
- **Alternativa descartada**: Trigger de PostgreSQL que rechaza `UPDATE` a `role_permissions WHERE role.name = 'super_admin'` — más robusto a nivel DB pero duplica lógica de negocio en SQL, dificulta los tests de integración y mezcla responsabilidades.
- **Consecuencia**: Los tests de dominio del `Role` entity son críticos — si `toAuthPermissions()` tiene un bug, el super_admin puede quedarse sin acceso o un rol normal puede obtener todos los permisos. El Test 1.1 del tdd-plan es el más importante del sub-spec.

---

### Decisión 4: FK `users.employee_id` diferida a migración 002 (hrms-employees)

- **Qué se decidió**: La migración `001_auth_roles.sql` crea `users.employee_id UUID NULL` sin FK constraint. La migración `002_employees.sql` (sub-spec 2) agrega `ALTER TABLE users ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id)`.
- **Por qué**: `employees` no existe en la migración 001 — no hay tabla a la que apuntar. Las opciones eran: (a) diferir la FK, (b) crear `employees` en la migración 001 (viola el principio de que cada sub-spec define sus propias tablas), o (c) usar una FK circular con DEFERRABLE (complejo y propenso a errores en tests). Diferir es lo más simple y explícito.
- **Alternativa descartada**: Crear una tabla `employees` vacía en 001 como placeholder — introduce un artefacto que no pertenece a este sub-spec y que el sub-spec 2 tendría que sobrescribir.
- **Consecuencia**: Si el sub-spec 2 olvida agregar la FK, la relación user↔employee existe en código pero no tiene integridad referencial en DB. Está documentado en el spec de hrms-employees como requisito explícito.

---

### Decisión 5: Inyección de dependencias manual con `container.ts` en lugar de InversifyJS o TSyringe

- **Qué se decidió**: Un archivo `packages/api/src/container.ts` instancia manualmente los repositorios, servicios y use cases:
  ```typescript
  const userRepo = new UserRepository(sql)
  const tokenSvc = new JwtTokenService(process.env.JWT_SECRET!)
  export const loginUseCase = new LoginUseCase(userRepo, tokenSvc)
  ```
- **Por qué**: Bun no tiene soporte estable de `reflect-metadata` (necesario para decoradores de InversifyJS/TSyringe). La inyección manual es totalmente type-safe, es explícita (se ve exactamente qué depende de qué), no añade una librería de 50+ kB al bundle, y es trivial de seguir en un code review. Para un sistema de 10 sub-specs con ~20-30 dependencias totales, el overhead de un framework DI no se justifica.
- **Alternativa descartada**: InversifyJS — madura, popular, pero requiere `reflect-metadata` y decoradores experimentales que Bun no soporta completamente aún. TSyringe tiene el mismo problema.
- **Consecuencia**: Cuando el proyecto crezca a 50+ dependencias, el container.ts puede volverse largo. Para esa escala, migrar a un container ligero sin decoradores (ej. `awilix`) es la salida limpia — sin cambiar las interfaces.

---

### Decisión 6: `postgres.js` como driver de base de datos en lugar de Prisma o Drizzle

- **Qué se decidió**: Usar `postgres` (el package npm `postgres`) con tagged template literals para todas las queries del boundary-postgres.
- **Por qué**: Prisma genera un cliente binario que no funciona de forma nativa con Bun — requiere workarounds para el query engine. Drizzle es excelente pero agrega una capa de abstracción que en hexagonal ya está cubierta por los repositorios: el repositorio ES la abstracción de queries. `postgres.js` es literalmente un wrapper delgado sobre el protocolo de PostgreSQL, zero-dependency, type-safe con generics manuales, y sus queries son SQL puro — cualquier persona que sepa PostgreSQL puede leer el código sin aprender una DSL.
- **Alternativa descartada**: Drizzle ORM — buena opción si no fuera por la arquitectura hexagonal. Con repositorios como adaptadores, Drizzle's query builder duplicaría la capa de abstracción. Prisma descartado por incompatibilidad con Bun runtime.
- **Consecuencia**: Las queries no son type-safe automáticamente — hay que escribir el tipo de retorno manualmente o usar `postgres.js` generics. Es el trade-off: más verbosidad en los repositorios, más control y menos magia.

---

### Decisión 7: Bun workspaces nativo en lugar de Nx o Turborepo

- **Qué se decidió**: El monorepo usa el sistema de workspaces nativo de Bun definido en el `package.json` raíz. No hay herramienta de orquestación de builds adicional.
- **Por qué**: Nx y Turborepo son excelentes para monorepos con docenas de paquetes y builds complejos con cache distribuida. Este proyecto tiene 5 paquetes con dependencias lineales (core ← boundary-postgres ← api ← ui). El overhead de configurar Nx (generators, executors, project.json por paquete) no se justifica. Bun workspaces resuelve la resolución de módulos inter-paquete nativamente y `bun run --filter` ejecuta scripts en paralelo sin configuración adicional.
- **Alternativa descartada**: Nx — descartado por complejidad de configuración para el tamaño del proyecto. Turborepo — más simple que Nx pero aún añade una herramienta externa para algo que Bun ya hace.
- **Consecuencia**: Si el proyecto crece a 15+ paquetes o necesita cache de build distribuida en CI, la migración a Turborepo es incremental (solo agregar `turbo.json` y `turbo` al pipeline de CI).

---

### Decisión 8: Angular 17 standalone components sin NgModules

- **Qué se decidió**: Todos los componentes Angular son standalone (`standalone: true`). Las rutas son lazy-loaded directamente por componente (`loadComponent`), no por módulo (`loadChildren` con NgModule).
- **Por qué**: Angular 17 hace que los NgModules sean opcionales. Los standalone components eliminan el boilerplate de declarar + exportar en un módulo. El lazy-loading por componente reduce el chunk size inicial porque no hay que agrupar en módulos para diferir la carga. Los tests con TestBed son más simples: se importa directamente el componente sin envolver en un módulo de test.
- **Alternativa descartada**: NgModules tradicionales — más familiar para equipos con experiencia en Angular < 14, pero introduce boilerplate que Angular mismo está depreciando gradualmente. Para un proyecto nuevo en 2026 con Angular 17, elegir NgModules sería ir contra la dirección del framework.
- **Consecuencia**: Los sub-specs 2-10 siguen el mismo patrón. Cada feature agrega sus componentes standalone y sus rutas lazy directamente al array de rutas del AppShell. No hay `FeatureModule` que importar.

---

### Decisión 9: Seed de roles del sistema con `INSERT ... ON CONFLICT DO NOTHING`

- **Qué se decidió**: La migración 001 incluye un seed de los 4 roles del sistema (`super_admin`, `hr_manager`, `finance`, `employee`) usando `INSERT INTO roles (...) ON CONFLICT (name) DO NOTHING`.
- **Por qué**: En CI, la base de datos de test se resetea entre runs pero las migraciones se aplican de nuevo. Sin idempotencia, el segundo run de tests falla con violación de UNIQUE constraint en `roles.name`. Con `ON CONFLICT DO NOTHING`, correr la migración N veces es seguro. Además, en un entorno de desarrollo, si alguien quiere probar sin resetear la DB completa, los roles del sistema siempre existen.
- **Alternativa descartada**: Seed en archivo separado ejecutado manualmente — más explícito pero más frágil: alguien puede olvidar ejecutarlo en un entorno nuevo y los tests de login fallan con "role not found" sin un error claro.
- **Consecuencia**: `is_system = true` en los 4 roles del seed garantiza que el guard de dominio (`role.assertCanDelete()`) los proteja. Si alguien inserta un rol del sistema fuera del seed sin poner `is_system = true`, el invariante no lo cubre.

---

### Decisión 10: PermissionGuard como función Angular (`CanActivateFn`) en lugar de clase

- **Qué se decidió**: El guard se implementa como función factory:
  ```typescript
  export const permissionGuard = (module: AppModule, action: keyof Omit<RolePermission, 'module'>) =>
    inject(AuthService).hasPermission(module, action)
      ? true
      : inject(Router).createUrlTree(['/forbidden'])
  ```
  Y se usa en rutas como: `canActivate: [permissionGuard(AppModule.EMPLOYEES, 'canView')]`
- **Por qué**: Angular 15+ deprecó la interfaz `CanActivate` en favor de `CanActivateFn`. Los functional guards permiten componer con `inject()` sin necesidad de un servicio de clase, se pueden testear como funciones puras (sin `new`), y la firma factory `permissionGuard(module, action)` hace que la declaración de ruta sea auto-documentada: se lee exactamente qué módulo y acción se requieren.
- **Alternativa descartada**: Clase `PermissionGuard implements CanActivate` con parámetro via `data` de la ruta — requiere leer `route.data.module` dentro del guard, lo que significa que el IDE no puede autocompletar el módulo en la declaración de ruta, y el error tipográfico en `data.module` es silencioso.
- **Consecuencia**: La firma `permissionGuard(AppModule.X, 'canView')` está congelada. Cambiarla después de que los sub-specs 2-10 la usen requiere tocar todas las rutas protegidas del sistema. El test P.1 del tdd-plan-ui la protege.

---

## Desviaciones del spec

Ninguna. Este documento se escribe antes de la implementación — documenta las decisiones de diseño tomadas durante el pipeline de planning. Las desviaciones reales (si las hay) se agregarán aquí durante la fase `/implement`.

---

## Deuda técnica generada

| # | Descripción | Impacto | Cuándo resolver |
|---|---|---|---|
| 1 | Sin recuperación de contraseña | Usuario bloqueado si olvida password — solo admin puede resetear | v2 antes de go-live |
| 2 | Sin rate limiting en `POST /auth/login` | Fuerza bruta posible en entornos expuestos | Antes de deploy a producción |
| 3 | `JWT_SECRET` gestionado como variable de entorno plana | Riesgo si el `.env` se filtra en CI/CD logs | Integrar secret manager antes de go-live |
| 4 | Refresh token family no implementado | Token robado antes de rotación sigue válido hasta expirar | v2 si se detectan incidentes de sesiones robadas |
| 5 | `registerLocaleData` para es/en/pt en AppModule | Sin esto, las pipes `date` y `currency` de Angular no se formatean correctamente | Sub-spec 2 (primer uso de fechas en la UI) |
| 6 | `users.employee_id` sin FK constraint | Integridad referencial no enforced en DB hasta sub-spec 2 | Migración 002 de hrms-employees |

---

## Archivos a crear (implementación pendiente)

| Archivo | Tipo | Motivo |
|---|---|---|
| `packages/core/src/contracts/auth.ts` | NUEVO | Interfaz `AuthenticatedUser` congelada |
| `packages/core/src/contracts/roles.ts` | NUEVO | `AppModule` enum + `RolePermission` interface |
| `packages/core/src/domain/role.entity.ts` | NUEVO | Clase `Role` con invariante `toAuthPermissions()` |
| `packages/core/src/domain/user.entity.ts` | NUEVO | Clase `User` con `assertCanAuthenticate()` |
| `packages/core/src/usecases/login.usecase.ts` | NUEVO | Orquesta login, verifica password, genera tokens |
| `packages/core/src/usecases/refresh-token.usecase.ts` | NUEVO | Rotación de refresh token |
| `packages/core/src/usecases/manage-roles.usecase.ts` | NUEVO | CRUD de roles con invariantes |
| `packages/core/src/ports/user.repository.port.ts` | NUEVO | Interface `IUserRepository` |
| `packages/core/src/ports/role.repository.port.ts` | NUEVO | Interface `IRoleRepository` |
| `packages/core/src/ports/token.service.port.ts` | NUEVO | Interface `ITokenService` |
| `packages/boundary-postgres/src/user.repository.ts` | NUEVO | Implementación postgres.js de `IUserRepository` |
| `packages/boundary-postgres/src/role.repository.ts` | NUEVO | Implementación postgres.js de `IRoleRepository` |
| `packages/boundary-postgres/migrations/001_auth_roles.sql` | NUEVO | Tablas + seed idempotente |
| `packages/api/src/container.ts` | NUEVO | Composition root — DI manual |
| `packages/api/src/routes/auth.routes.ts` | NUEVO | POST /auth/login, /auth/refresh, /auth/logout |
| `packages/api/src/routes/roles.routes.ts` | NUEVO | GET/POST/PUT/DELETE /roles |
| `packages/api/src/middleware/auth.middleware.ts` | NUEVO | Verificación JWT en cada request |
| `packages/api/src/middleware/permission.middleware.ts` | NUEVO | Verificación de módulo+acción |
| `packages/api/src/mappers/user.mapper.ts` | NUEVO | Domain User → AuthenticatedUser DTO |
| `apps/hrms-ui/src/app/auth/auth.service.ts` | NUEVO | Estado reactivo (signal) + HTTP calls |
| `apps/hrms-ui/src/app/auth/guards/auth.guard.ts` | NUEVO | `CanActivateFn` — verifica sesión |
| `apps/hrms-ui/src/app/auth/guards/permission.guard.ts` | NUEVO | Factory `permissionGuard(module, action)` |
| `apps/hrms-ui/src/app/auth/login/login.component.ts` | NUEVO | Smart — formulario reactivo |
| `apps/hrms-ui/src/app/shell/shell.component.ts` | NUEVO | Sidebar + header + language selector |
| `apps/hrms-ui/src/app/roles/roles.component.ts` | NUEVO | Smart — lista + CRUD de roles |
| `apps/hrms-ui/src/app/roles/role-form/role-form.component.ts` | NUEVO | Dumb — form con checkboxes |
| `apps/hrms-ui/src/assets/i18n/es.json` | NUEVO | Traducciones español (default) |
| `apps/hrms-ui/src/assets/i18n/en.json` | NUEVO | Traducciones inglés |
| `apps/hrms-ui/src/assets/i18n/pt.json` | NUEVO | Traducciones portugués |

---

## Mensaje de commit

```
feat(hrms-auth-roles): implementar autenticación JWT, roles y permisos (#1/10)

Establece la base de seguridad del sistema HRMS. Todos los sub-specs
restantes dependen de estos contratos: AuthenticatedUser shape, AppModule
enum y la firma de permissionGuard(module, action).

Se eligió JWT stateless para soportar múltiples instancias de API sin
estado compartido. La invariante super_admin vive en el dominio (no en DB)
para garantizar que ninguna ruta de código pueda saltarla. DI manual sobre
InversifyJS porque Bun no soporta reflect-metadata de forma estable.

BREAKING CHANGE: primera implementación — no hay código anterior que romper.
TODO: agregar rate limiting en POST /auth/login antes de deploy a producción
TODO: registerLocaleData para es/en/pt antes de sub-spec 2 (primer uso de date pipe)
```

---

## Referencias

- Spec: `docs/specs/hrms-auth-roles.spec.md`
- Impact: `docs/specs/hrms-auth-roles.impact.md`
- Arch: `docs/specs/hrms-auth-roles.arch.md`
- TDD Plan backend: `docs/specs/hrms-auth-roles.tdd-plan.md`
- TDD Plan UI: `docs/specs/hrms-auth-roles.tdd-plan-ui.md`
- Split master: `docs/specs/hrms-hex.split.md`
